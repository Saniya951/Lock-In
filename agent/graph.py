from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
import json
import os
import re
import uuid
import time
from memory import CodeMemory 
from typing import List, Literal, Dict, Any 

from prompts import *
from states import * 
from termcolor import cprint

from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_community.vectorstores import Chroma
from tavily import TavilyClient

from langchain_core.pydantic_v1 import BaseModel, Field

# --- Configuration ---
SUPPORTED_SITES = {
    "React": "react.dev",
    "Flask": "flask.palletsprojects.com"
}

llm = ChatGroq(model="llama-3.3-70b-versatile")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
DB_PATH = os.path.join(SCRIPT_DIR, "chroma_db") 
# --- Directory to save generated code ---
# CODE_OUTPUT_DIR = os.path.join(OUTPUT_DIR, "code") 
# ========================

os.makedirs(OUTPUT_DIR, exist_ok=True)
# os.makedirs(CODE_OUTPUT_DIR, exist_ok=True) # Create code output dir
HF_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# --- Load Vector Database ---
cprint(f" Loading vector database from {DB_PATH}...", "yellow")
embeddings = HuggingFaceEndpointEmbeddings(repo_id=HF_EMBEDDING_MODEL)
db = Chroma(persist_directory=DB_PATH, embedding_function=embeddings)
retriever = db.as_retriever(search_kwargs={"k": 3})
cprint(" Vector database loaded successfully.", "green")

# --- Initialize Tavily Client ---
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
cprint(" Tavily client initialized.", "green")

e2b_api_key=os.getenv("E2B_API_KEY")
# --- Agent Definitions ---

def route_query(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Router...", "cyan", attrs=["bold"])
    
    users_prompt = state["user_prompt"]
    cprint(f" Routing query: {users_prompt[:100]}...", "yellow")
    
    response = llm.with_structured_output(QueryRoute).invoke(
        router_prompt(users_prompt) 
    )
    
    if response is None:
        cprint("Router failed, defaulting to 'build'", "red")
        return {"route": "build"}
        
    cprint(f" Decision: Route -> {response.route}", "green")
    return {"route": response.route}

def planner_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Planner Workflow...", "cyan", attrs=["bold"])
    
    users_prompt = state["user_prompt"]
    response = llm.with_structured_output(Plan).invoke(planner_prompt(users_prompt))
    if response is None:
        raise ValueError("Planner did not return a valid response.")
    
    try:
        session_id = state["session_id"]
        # Each user gets their own folder
        user_dir = os.path.join(OUTPUT_DIR, session_id, "plan") 
        os.makedirs(user_dir,exist_ok=True)
        # ... write to file_path ...
        file_path = os.path.join(user_dir, "plan_output.json")
        with open(file_path, "w") as f:
            json.dump(response.model_dump(), f, indent=4)
        cprint(f" Plan saved to {file_path}", "green")
    except Exception as e:
        cprint(f"Error saving plan output: {e}", "red")
        
    return {"plan": response}

def architect_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Architect Workflow...", "cyan", attrs=["bold"])
    
    plan: Plan = state["plan"]
    response = llm.with_structured_output(TaskPlan).invoke(architect_prompt(plan))
    if response is None:
        raise ValueError("Architect did not return a valid response.")
    response.plan = plan
    # We convert the Pydantic objects to simple dicts for the state
    queue_steps = [step.model_dump() for step in response.implementation_steps]    
    cprint(f" Architect generated {len(queue_steps)} file tasks.", "green")
    
    try:
        session_id = state["session_id"]
        # Each user gets their own folder
        user_dir = os.path.join(OUTPUT_DIR, session_id, "plan") 
        os.makedirs(user_dir,exist_ok=True)
        file_path = os.path.join(user_dir, "architect_output.json")
        with open(file_path, "w") as f:
            json.dump(response.model_dump(), f, indent=4)
        cprint(f" TaskPlan saved to {file_path}", "green")
    except Exception as e:
        cprint(f"Error saving architect output: {e}", "red")
        
    return {
        "task_queue": queue_steps,
        "current_task_index": 0,    # Initialize the pointer
        "completed_files": [],       # Initialize the log
        "error_report": ""
    }
# --- Helper: Research Strategy ---
def perform_jit_research(topic: str, use_tavily: bool) -> str:
    """Performs Just-In-Time research using the selected method."""
    if not topic:
        return "No specific topic provided."

    if use_tavily:
        cprint(f"   [Tavily] Researching: {topic}...", "blue")
        try:
            results = tavily_client.search(topic, max_results=3)
            context = []
            for res in results.get("results", []):
                context.append(f"Source: {res['url']}\nContent: {res['content']}")
            return "\n\n".join(context)
        except Exception as e:
            cprint(f"   [Tavily] Failed: {e}. Falling back to VectorDB.", "red")

    # Default / Fallback: VectorDB
    cprint(f"   [VectorDB] Retrieving docs for: {topic}...", "yellow")
    try:
        results = retriever.invoke(topic)
        return "\n".join([d.page_content for d in results])
    except Exception as e:
        cprint(f"   [VectorDB] Failed: {e}", "red")
        return "No documentation found."

def coder_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    
    # 1. SETUP & QUEUE MANAGEMENT
    queue = state.get("task_queue", [])
    index = state.get("current_task_index", 0)
    
    if index >= len(queue):
        cprint(" All tasks in queue completed.", "green")
        return {"current_task_index": index} 

    current_step = queue[index]
    filename = current_step['file_name']
    task_desc = current_step['task_description']
    topic = current_step['related_docs_topic']
    
    session_id = state["session_id"]
    user_code_dir = os.path.join(OUTPUT_DIR, session_id, "code") 
    file_path = os.path.join(user_code_dir, filename)

    cprint(f" Processing File ({index+1}/{len(queue)}): {filename}", "cyan", attrs=["bold"])

    # 2. RETRIEVAL
    search_method = state.get("search_method", False)
    doc_context = perform_jit_research(topic, search_method)

    # 3. DETECT MODE: "BUILD" vs "FIX"
    error_report = state.get("error_report")
    
    file_exists = os.path.exists(file_path)
    existing_code = ""

    if file_exists:
        with open(file_path, "r", encoding="utf-8") as f:
            existing_code = f.read()

    # 4. CONSTRUCT PROMPT
    mode = "fix" if (error_report and file_exists) else "build"
    
    if mode == "fix":
        cprint("   [Mode] Repairing existing code based on error...", "yellow", attrs=["blink"])
    else:
        cprint("   [Mode] Generating new code...", "green")

    prompt = construct_coder_prompt(
        filename=filename,
        task_desc=task_desc,
        doc_context=doc_context,
        mode=mode,
        existing_code=existing_code,
        error_report=error_report
    )

    # 5. GENERATE
    try:
        response = llm.invoke(prompt)
        code_content = response.content.strip()
        
        # Cleanup Markdown
        if code_content.startswith("```"):
            code_content = re.sub(r"^```[a-zA-Z]*\n", "", code_content)
            code_content = re.sub(r"\n```$", "", code_content)

        # 6. WRITE TO DISK
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code_content)
            
        # 7. ATOMIC INDEXING
        # to make sure that code is embedded even when hf gives 504 gateway error. 
        max_retries = 5
        base_delay = 2

        for attempt in range(max_retries):
            try:
                memory = CodeMemory(DB_PATH, HF_EMBEDDING_MODEL)
                memory.update_file(session_id, filename, code_content)
                cprint(f"   Saved & Indexed {filename}", "green")
                break # Success, exit loop
                
            except Exception as e:
                # Check if it's a timeout or server error (504, 503, 500)
                error_str = str(e)
                if "504" in error_str or "503" in error_str or "Time-out" in error_str:
                    if attempt < max_retries - 1:
                        wait = base_delay * (2 ** attempt) # Exponential backoff (2s, 4s, 8s...)
                        cprint(f"   Embedding API busy (504). Retrying in {wait}s...", "yellow")
                        time.sleep(wait)
                        continue
                
                # If it's a real error (not timeout) or we ran out of retries, crash.
                cprint(f"   Indexing failed: {e}", "red")
                raise e
            
    except Exception as e:
        cprint(f"   Generation failed: {e}", "red")
        raise e

    # 8. UPDATE STATE
    return {
        "current_task_index": index + 1,
        "completed_files": [filename],
        "error_report": "" 
    }

# def executor_agent(state: GraphState) -> dict:
#     cprint(f"\n{'='*50}", "magenta")
#     cprint(" Entering Executor (MOCK)...", "cyan", attrs=["bold"])
    
#     # Get current iteration count (default to 0)
#     count = state.get("iteration_count") or 0
    
#     # LOGIC: Fail on the first try (0), Pass on the second (1)
#     if count == 0:
#         cprint(" [MOCK] Simulating runtime error...", "red")
#         #  
#         fake_logs = """
#         Traceback (most recent call last):
#           File "app.py", line 14, in <module>
#             from flask import Flasck
#         ImportError: cannot import name 'Flasck' from 'flask'
#         """
#     else:
#         cprint(" [MOCK] Simulating successful execution...", "green")
#         fake_logs = " * Running on http://127.0.0.1:5000 (Press CTRL+C to quit)"
        
#     return {"execution_logs": fake_logs, "iteration_count": count + 1}

from e2b_code_interpreter import Sandbox

def executor_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Executor (Dynamic E2B Sandbox)...", "cyan", attrs=["bold"])
    
    session_id = state["session_id"]
    user_code_dir = os.path.join(OUTPUT_DIR, session_id, "code")
    
    # 1. DYNAMIC FILE DISCOVERY 
    # We gather the file structure so the agent knows what it's working with.
    project_files = []
    for root, _, files in os.walk(user_code_dir):
        for file in files:
            # We only care about relative paths for context
            rel_path = os.path.relpath(os.path.join(root, file), user_code_dir)
            project_files.append(rel_path)
    
    files_context = ", ".join(project_files[:20]) # Limit to top 20 files to save context
    cprint(f"   Identified project files: {files_context[:100]}...", "yellow")

    # 2. TAVILY SEARCH FOR BUILD COMMANDS
    # We ask Tavily to find the best way to run a project with these specific files.
    search_query = f"best terminal commands to build and run a software project containing these files: {files_context}"
    cprint(f"   Searching Tavily for build protocols: '{search_query[:50]}...'", "blue")
    
    try:
        search_results = tavily_client.search(search_query, max_results=2)
        search_context = "\n".join([res['content'] for res in search_results.get('results', [])])
    except Exception as e:
        cprint(f"   Tavily search failed, relying on LLM intuition: {e}", "red")
        search_context = "No search results available."

    # 3. LLM COMMAND DECISION
    # The LLM decides the commands based on the files and the search advice.
    cprint("   Synthesizing build commands via LLM...", "blue")
    
    command_prompt = f"""
    You are a DevOps Expert.
    
    PROJECT FILES DETECTED:
    {files_context}
    
    RECENT ONLINE DOCUMENTATION (TAVILY):
    {search_context}
    
    TASK:
    Determine the exact Linux terminal commands to:
    1. Install dependencies (`install_cmd`)
    2. Run/Start the application (`run_cmd`)
    
    CRITICAL RULES:
    - If it is a full stack app (e.g., React + Flask), chain the commands logic carefully (e.g., install both).
    - For the `run_cmd`, ensure it starts the server.
    - Output ONLY the commands in the schema.
    """
    
    commands = llm.with_structured_output(ExecutionCommands).invoke(command_prompt)
    
    install_cmd = commands.install_cmd
    run_cmd = commands.run_cmd
    
    cprint(f"   Determined Install Command: {install_cmd}", "green")
    cprint(f"   Determined Run Command: {run_cmd}", "green")

    logs = ""
    
    # 3. RUN IN SANDBOX (UPDATED FOR NEW API)
    try:
        cprint("   Spinning up Cloud Sandbox...", "blue")
        
        # We set a longer timeout for the sandbox itself
        with Sandbox.create() as sandbox:
            
            # A. Upload Files
            for root, _, files in os.walk(user_code_dir):
                for file in files:
                    local_path = os.path.join(root, file)
                    rel_path = os.path.relpath(local_path, user_code_dir)
                    with open(local_path, "rb") as f:
                        # Upload file to the sandbox
                        sandbox.files.write(f"/home/user/app/{rel_path}", f)
            
            # B. Install Dependencies
            cprint(f"   Executing Install: {commands.install_cmd}...", "yellow")
            
            # NEW API: use commands.run() instead of process.start_and_wait()
            install_result = sandbox.commands.run(
                f"cd /home/user/app && {commands.install_cmd}",
                timeout=180 # 3 minutes for heavy npm installs
            )
            
            if install_result.exit_code != 0:
                raise Exception(f"Install Failed:\n{install_result.stderr}")
            
            logs += f"INSTALL LOGS:\n{install_result.stdout}\n"
            cprint("   Dependencies installed successfully.", "green")

            # C. Run Application (Background)
            cprint(f"   Executing Run: {commands.run_cmd}...", "green")
            
            # We run the server in the background so we can check if it crashes
            server_result = sandbox.commands.run(
                f"cd /home/user/app && {commands.run_cmd}",
                background=True 
            )
            
            # Wait 5 seconds to see if it crashes immediately
            import time
            time.sleep(5) 
            
            # To check logs of a background process, we usually check output 
            # or rely on the fact it didn't crash. 
            logs += "Server command sent to background.\n"
            logs += "If the app crashes, the debugger will catch it in the next step."

        return {"execution_logs": logs, "iteration_count": state.get("iteration_count", 0) + 1}

    except Exception as e:
        error_msg = str(e)
        cprint(f"   Execution Failed: {error_msg}", "red")
        return {
            "execution_logs": f"{logs}\nCRITICAL ERROR:\n{error_msg}", 
            "iteration_count": state.get("iteration_count", 0) + 1
        }

# --- NEW: EVALUATOR AGENT ---
class EvalOutput(BaseModel):
    status: Literal["pass", "fail"]
    feedback: str = Field(description="Explanation of why it failed or passed")

def evaluator_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Evaluator...", "cyan", attrs=["bold"])
    
    logs = state["execution_logs"]
    
    # Simple Heuristic for the Mock (can be replaced with LLM call later)
    if "Traceback" in logs or "ImportError" in logs or "Error" in logs:
        status = "fail"
        feedback = f"Execution failed with logs: {logs}"
        cprint(f" Evaluation: FAIL", "red")
    else:
        status = "pass"
        feedback = "Code ran successfully."
        cprint(f" Evaluation: PASS", "green")
        
    return {"status": status, "error_report": feedback}

# --- NEW: DEBUGGER AGENT ---
def debugger_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Debugger...", "cyan", attrs=["bold"])
    
    session_id = state["session_id"]
    error = state["error_report"]
    iteration = state.get("iteration_count", 1)
    
    cprint(f" Analyzing Error (Iteration {iteration}): {error[:100]}...", "red")
    
    # --- 1. SMART RETRIEVAL (Context Awareness) ---
    # The Debugger needs to see the code to fix it.
    # We query our CodeMemory for files relevant to the error.
    # (Assumes you have instantiated 'memory' globally or pass it in)
    try:
        memory = CodeMemory(DB_PATH, HF_EMBEDDING_MODEL) # Uncomment if not global
        cprint("   Querying vector DB codebase for relevant code context...", "yellow")
        relevant_context = memory.query_codebase(session_id, error, k=3)
    except Exception as e:
        cprint(f"   Retrieval failed: {e}", "red")
        relevant_context = "No code context available due to error."

    # --- 2. GENERATE FIX PLAN ---
    # We pass the error AND the retrieved code to the LLM
    prompt = f"""
    You are a Senior Debugging Architect.
    
    THE ERROR:
    {error}
    
    RELEVANT CODE SNIPPETS:
    {relevant_context}
    
    TASK:
    Analyze the error and the code. Create a plan to fix the specific file causing the issue.
    Return a TaskPlan with the specific file(s) that need to be patched.
    """
    
    fix_plan = llm.with_structured_output(TaskPlan).invoke(prompt)
    
    # --- 3. SAVE TO DISK (Session & Iteration Aware) ---
    try:
        # We create a 'debug' folder for this user
        user_debug_dir = os.path.join(OUTPUT_DIR, session_id, "debug")
        os.makedirs(user_debug_dir, exist_ok=True)
        
        # We append the iteration count so we don't overwrite previous debug attempts
        file_path = os.path.join(user_debug_dir, f"fix_plan_iter_{iteration}.json")
        
        with open(file_path, "w") as f:
            json.dump(fix_plan.model_dump(), f, indent=4)
        cprint(f" Fix plan saved to {file_path}", "green")
        
    except Exception as e:
        cprint(f"Error saving debug output: {e}", "red")

    # --- 4. UPDATE STATE ---
    new_queue = [step.model_dump() for step in fix_plan.implementation_steps]
    cprint(f" Debugger created {len(new_queue)} repair tasks.", "green")

    return {
        "task_queue": new_queue,
        "current_task_index": 0, 
        "error_report": error # Keep error so Coder knows to enter "Fix Mode"
    }

def learner_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Learner Agent (Placeholder)...", "cyan", attrs=["bold"])
    return {} 

# --- Graph Definition ---
graph = StateGraph(GraphState)

# --- Add all nodes ---
graph.add_node("router", route_query)
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder", coder_agent) 
graph.add_node("debugger", debugger_agent)
graph.add_node("learner", learner_agent)
graph.add_node("executor", executor_agent)
graph.add_node("evaluator", evaluator_agent)

# --- Set the router as the entry point ---
graph.set_entry_point("router")

# --- Define conditional edge functions ---
def route_decision(state: GraphState) -> Literal["planner", "debugger", "learner"]:
    route = state.get("route")
    if route == "build":
        return "planner"
    elif route == "debug":
        return "debugger"
    elif route == "learn":
        return "learner"
    else:
        return "planner"

def check_queue_status(state: GraphState) -> Literal["coder", "evaluator"]:
    queue = state.get("task_queue", [])
    index = state.get("current_task_index", 0)
    
    if index < len(queue):
        return "coder"  # Go back and do the next file
    else:
        return "executor" # All files done, now check the work

def check_evaluation(state: GraphState) -> Literal["debugger", END]:
    status = state.get("status")
    count = state.get("iteration_count", 0)
    
    if status == "fail" and count < 3: # Limit retries to 3
        return "debugger"
    return END

# --- Add edges and conditional edges ---
graph.add_conditional_edges(
    "router",
    route_decision,
    {
        "planner": "planner",
        "debugger": "debugger",
        "learner": "learner"
    }
)

graph.add_edge("planner", "architect")
graph.add_edge("architect","coder")
graph.add_conditional_edges(
    "coder",
    check_queue_status,
    {
        "coder": "coder",       # Loop back
        "executor": "executor" # Move on
    }
)
graph.add_edge("executor", "evaluator")

graph.add_conditional_edges("evaluator", check_evaluation,
    {"debugger": "debugger", END: END})

graph.add_edge("debugger", "coder") # Close the loop!         
graph.add_edge("learner", END)

agent = graph.compile()

cprint("\nWelcome to Lock-In", "yellow", attrs=["bold"])
user_prompt = input("Please enter your project request: ")

search_method_input = input("Choose search method: 0 for 'default' (vector DB) or 1 for 'advance' (Live Search): ").strip()
search_method = (search_method_input == "1")  # True for advance, False for default

session_id = str(uuid.uuid4())
cprint(f" Session ID generated: {session_id}", "cyan")

initial_state: GraphState = {
    "session_id":session_id,
    "user_prompt": user_prompt,
    "route": None,
    "plan": None, 
    "task_queue":[],
    "completed_files": [],
    "current_task_index": 0, 
    "retrieved_context": None,
    "search_method": search_method,
    "iteration_count": 0, # Initialize count
    "execution_logs": "",
    "error_report": "",
    "status" : ""
}
result = agent.invoke(initial_state)

cprint(f"\n{'='*50}", "magenta")
cprint("\n Agent workflow finished. Final state:", "green", attrs=["bold"])
import pprint
pprint.pprint(result)