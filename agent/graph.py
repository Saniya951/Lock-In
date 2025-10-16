from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langgraph.constants import END
from langgraph.graph import StateGraph
import json

from prompts import *
from states import *

import os
groq_api_key = os.getenv("GROQ_API_KEY")

llm = ChatGroq(model="openai/gpt-oss-120b")

OUTPUT_DIR = "output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def planner_agent(state: GraphState)-> dict:
    users_prompt = state["user_prompt"]
    response = llm.with_structured_output(Plan).invoke(planner_prompt(user_prompt))
    if response is None:
        raise ValueError("Planner did not return a valid response.")

    # Save the output to plan_output.json
    try:
        file_path = os.path.join(OUTPUT_DIR, "plan_output.json")
        with open(file_path, "w") as f:
            json.dump(response.dict(), f, indent=4)
        print(f"Plan saved to {file_path}")
    except Exception as e:
        print(f"Error saving plan output: {e}")

    return {"plan": response}




def architect_agent(state: GraphState)-> dict:
    plan : Plan = state["plan"] #prev node(planner) output is plan which is input to this architect
    response = llm.with_structured_output(TaskPlan).invoke(architect_prompt(plan))
    if response is None:
        raise ValueError("Architect did not return a valid response.")
    response.plan = plan

    # Save the output to architect_output.json
    try:
        file_path = os.path.join(OUTPUT_DIR, "architect_output.json")
        with open(file_path, "w") as f:
            json.dump(response.dict(), f, indent=4)
        print(f"TaskPlan saved to {file_path}")
    except Exception as e:
        print(f"Error saving architect output: {e}")

    return {"task_plan": response}

graph = StateGraph(GraphState)
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_edge("planner", "architect")
graph.set_entry_point("planner") #tell the graph where to begin the workflow:

agent = graph.compile()

user_prompt="create a simple to do list web application"
result  = agent.invoke({"user_prompt": user_prompt}) # this calls planner_agent as we define the entry point as "Planner"

print(result)