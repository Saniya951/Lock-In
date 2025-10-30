from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
import json
import os
from typing import List, Literal, Dict, Any 

from prompts import *
from states import * 
from termcolor import cprint

from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_community.vectorstores import Chroma

# --- Setup ---
llm = ChatGroq(model="openai/gpt-oss-120b")

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

# --- Agent Definitions ---

def route_query(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Router...", "cyan", attrs=["bold"])
    
    users_prompt = state["user_prompt"]
    cprint(f" Routing query: {users_prompt[:100]}...", "yellow")
    
    response = llm.with_structured_output(QueryRoute).invoke(
        router_prompt(users_prompt) # Assumes router_prompt is in prompts.py
    )
    
    if response is None:
        cprint("Router failed, defaulting to 'build'", "red")
        return {"route": "build"}
        
    cprint(f" Decision: Route -> {response.route}", "green")
    return {"route": response.route}

def planner_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Planner Agent...", "cyan", attrs=["bold"])
    
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
    cprint(" Entering Architect Agent...", "cyan", attrs=["bold"])
    
    plan: Plan = state["plan"]
    response = llm.with_structured_output(TaskPlan).invoke(architect_prompt(plan))
    if response is None:
        raise ValueError("Architect did not return a valid response.")
    response.plan = plan
    
    try:
        file_path = os.path.join(OUTPUT_DIR, "architect_output.json")
        with open(file_path, "w") as f:
            json.dump(response.model_dump(), f, indent=4)
        cprint(f" TaskPlan saved to {file_path}", "green")
    except Exception as e:
        cprint(f"Error saving architect output: {e}", "red")
        
    return {"task_plan": response}

def researcher_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Researcher Agent...", "cyan", attrs=["bold"])
    
    plan: Plan = state["plan"] 
    task_plan: TaskPlan = state["task_plan"]
    
    first_task = task_plan.implementation_steps[0]['task_description']
    cprint(f" Researching task: {first_task}...", "yellow")
    cprint(f" Project context: {plan.project_goal}", "blue")

    prompt = research_prompt(first_task, plan) 
    response = llm.with_structured_output(ResearchQueries).invoke(prompt)

    queries = response.queries
    cprint(f" Generated queries: {queries}", "blue")

    all_docs = []
    for query in queries:
        docs = retriever.invoke(query)
        all_docs.extend(docs)

    context_str = "\n\n---\n\n".join([doc.page_content for doc in all_docs])
    
    doc_sources = []
    for doc in all_docs:
        source = doc.metadata.get("source", "Unknown")
        doc_sources.append({
            "content": doc.page_content,
            "source": source
        })
    cprint(f" Retrieved {len(doc_sources)} documents with sources.", "green")

    return {
        "research_queries": queries, 
        "retrieved_context": context_str,
        "retrieved_docs": doc_sources
    }

def coder_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Coder Agent...", "cyan", attrs=["bold"])
    
    plan: Plan = state["plan"]
    task_plan: TaskPlan = state["task_plan"]
    context: str = state["retrieved_context"]
    
    cprint(" Generating code for the first task...", "yellow")
    
    prompt = coder_prompt(plan, task_plan, context)
    response = llm.with_structured_output(GeneratedCode).invoke(prompt)
    
    if response is None or not response.files:
        cprint("Coder did not return valid code.", "red")
        raise ValueError("Coder did not return valid code.")
        
    cprint(f" Generated {len(response.files)} file(s).", "green")
    
    # Save the generated code to the output/code directory
    try:
        for code_file in response.files:
            # Create subdirectories if they don't exist
            file_path = os.path.join(CODE_OUTPUT_DIR, code_file.file_name)
            file_dir = os.path.dirname(file_path)
            os.makedirs(file_dir, exist_ok=True)
            
            # Write the code to the file
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code_file.content)
            cprint(f"  Saved code to {file_path}", "green")
            
    except Exception as e:
        cprint(f"Error saving code files: {e}", "red")

    return {"generated_code": response}

# --- Placeholder Agent Functions ---
def debugger_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Debugger Agent (Placeholder)...", "cyan", attrs=["bold"])
    return {} 

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
graph.add_node("researcher", researcher_agent)
graph.add_node("coder", coder_agent) # NEW: Add coder node
graph.add_node("debugger", debugger_agent)
graph.add_node("learner", learner_agent)

# --- Set the router as the entry point ---
graph.set_entry_point("router")

# --- Define a conditional edge function ---
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

# --- Add conditional edges from the router ---
graph.add_conditional_edges(
    "router",
    route_decision,
    {
        "planner": "planner",
        "debugger": "debugger",
        "learner": "learner"
    }
)

# --- Define the edges for the "build" flow ---
graph.add_edge("planner", "architect")
graph.add_edge("architect", "researcher")
graph.add_edge("researcher", "coder") 
graph.add_edge("coder", END)          

# --- Define the edges for the other flows (they just end for now) ---
graph.add_edge("debugger", END)
graph.add_edge("learner", END)

# --- Compile and Run ---
agent = graph.compile()

cprint("\nWelcome to Lock-In", "yellow", attrs=["bold"])
user_prompt = input("Please enter your project request: ")

initial_state: GraphState = {
    "user_prompt": user_prompt,
    "route": None,
    "plan": None, 
    "task_plan": None,
    "research_queries": None, 
    "retrieved_context": None,
    "retrieved_docs": None,
    "generated_code": None 
}
result = agent.invoke(initial_state)

cprint(f"\n{'='*50}", "magenta")
cprint("\n Agent workflow finished. Final state:", "green", attrs=["bold"])
import pprint
pprint.pprint(result)