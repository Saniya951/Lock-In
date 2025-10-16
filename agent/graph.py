from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
import json
import os
from typing import List

from prompts import *
from states import *
from termcolor import cprint

from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_community.vectorstores import Chroma

# --- Setup ---
llm = ChatGroq(model="openai/gpt-oss-120b")
OUTPUT_DIR = "output"
os.makedirs(OUTPUT_DIR, exist_ok=True)
DB_PATH = "chroma_db"
HF_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# --- Load Vector Database ---
cprint(" Loading vector database from Chroma...", "yellow")
embeddings = HuggingFaceEndpointEmbeddings(
    repo_id=HF_EMBEDDING_MODEL
)
db = Chroma(persist_directory=DB_PATH, embedding_function=embeddings)
retriever = db.as_retriever(search_kwargs={"k": 3})
cprint(" Vector database loaded successfully.", "green")

# --- Agent Definitions ---

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
            # Use model_dump() instead of the deprecated dict()
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
            # Use model_dump() instead of the deprecated dict()
            json.dump(response.model_dump(), f, indent=4)
        cprint(f" TaskPlan saved to {file_path}", "green")
    except Exception as e:
        cprint(f"Error saving architect output: {e}", "red")
        
    return {"task_plan": response}

def researcher_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Researcher Agent...", "cyan", attrs=["bold"])
    
    task_plan: TaskPlan = state["task_plan"]
    first_task = task_plan.implementation_steps[0].task_description
    # first_task = task_plan.implementation_steps[0]
    cprint(f" Researching task: {first_task}...", "yellow")

    response = llm.with_structured_output(ResearchQueries).invoke(research_prompt(first_task))

    # The output is now an object, so we access the list via .queries
    queries = response.queries
    cprint(f" Generated queries: {queries}", "blue")

    all_docs = []
    for query in queries:
        docs = retriever.invoke(query)
        all_docs.extend(docs)

    context_str = "\n\n---\n\n".join([doc.page_content for doc in all_docs])
    cprint(f" Retrieved context of length: {len(context_str)} characters.", "green")

    return {"research_queries": queries, "retrieved_context": context_str}

# --- Graph Definition ---
graph = StateGraph(GraphState)

graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("researcher", researcher_agent)

graph.set_entry_point("planner")
graph.add_edge("planner", "architect")
graph.add_edge("architect", "researcher")
graph.add_edge("researcher", END)

# --- Compile and Run ---
agent = graph.compile()

cprint("\nWelcome to Lock-In", "yellow", attrs=["bold"])
user_prompt = input("Please enter your project request: ")

initial_state = {
    "user_prompt": user_prompt,
    "plan": None, "task_plan": None,
    "research_queries": None, "retrieved_context": None
}
result = agent.invoke(initial_state)

cprint(f"\n{'='*50}", "magenta")
cprint("\n Agent workflow finished. Final state:", "green", attrs=["bold"])
import pprint
pprint.pprint(result)