from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
import json
import os
import re
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
CODE_OUTPUT_DIR = os.path.join(OUTPUT_DIR, "code") 
# ========================

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(CODE_OUTPUT_DIR, exist_ok=True) # Create code output dir
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
        file_path = os.path.join(OUTPUT_DIR, "plan_output.json")
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
        file_path = os.path.join(OUTPUT_DIR, "architect_output.json")
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
    
    cprint(f" Processing File ({index+1}/{len(queue)}): {filename}", "cyan", attrs=["bold"])

    # 2. RETRIEVAL (Integrated Research)
    search_method = state.get("search_method", False) # default to False=Vector, True=Tavily
    doc_context = perform_jit_research(topic, search_method)

    # 3. DETECT MODE: "BUILD" vs "FIX"
    # We check if we are in a feedback loop by looking for an error report
    error_report = state.get("error_report")
    
    # Check if the file already exists (important for fixing)
    file_path = os.path.join(CODE_OUTPUT_DIR, filename)
    file_exists = os.path.exists(file_path)
    existing_code = ""

    if file_exists:
        with open(file_path, "r", encoding="utf-8") as f:
            existing_code = f.read()

    #4.Mode
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
        
        # Strip markdown code blocks if the LLM adds them despite instructions
        if code_content.startswith("```"):
            import re
            code_content = re.sub(r"^```[a-zA-Z]*\n", "", code_content)
            code_content = re.sub(r"\n```$", "", code_content)

        # 6. WRITE TO DISK (Side Effect)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code_content)
            
        cprint(f"   Saved {filename} to disk.", "green")

    except Exception as e:
        cprint(f"   Generation failed: {e}", "red")
        raise e

    # 6. UPDATE STATE
    # If we were fixing, we clear the error report for the next file
    return {
        "current_task_index": index + 1,
        "completed_files": [filename],
        "error_report": "" # Clear error after attempting fix
    }

def executor_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Executor (MOCK)...", "cyan", attrs=["bold"])
    
    # Get current iteration count (default to 0)
    count = state.get("iteration_count") or 0
    
    # LOGIC: Fail on the first try (0), Pass on the second (1)
    if count == 0:
        cprint(" [MOCK] Simulating runtime error...", "red")
        #  
        fake_logs = """
        Traceback (most recent call last):
          File "app.py", line 14, in <module>
            from flask import Flasck
        ImportError: cannot import name 'Flasck' from 'flask'
        """
    else:
        cprint(" [MOCK] Simulating successful execution...", "green")
        fake_logs = " * Running on http://127.0.0.1:5000 (Press CTRL+C to quit)"
        
    return {"execution_logs": fake_logs, "iteration_count": count + 1}

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
    
    error = state["error_report"]
    cprint(f" Analyzing Error: {error[:100]}...", "red")
    
    # 1. Ask LLM to identify the culprit file and the fix
    # (Simplified for brevity - assumes we know which file broke)
    # In a real app, you'd parse the stack trace to find the filename.
    
    # Let's assume we want to retry the LAST file that was processed
    # or the LLM identifies the file from the logs.
    
    # For this example, let's say the LLM decides 'src/App.js' needs fixing
    fix_plan = llm.with_structured_output(TaskPlan).invoke(
        f"Based on this error:\n{error}\n\nCreate a plan to fix the code. Return a TaskPlan with the specific file to fix."
    )
    
    new_queue = [step.model_dump() for step in fix_plan.implementation_steps]
    cprint(f" Debugger created {len(new_queue)} repair tasks.", "green")

    # 2. RESET STATE FOR THE LOOP
    # We replace the old queue with the new "Fix Queue"
    # We reset the index to 0 so the Coder starts working on the fix immediately
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

initial_state: GraphState = {
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