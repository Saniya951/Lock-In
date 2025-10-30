from typing import List, Dict
from states import *
# def planner_prompt(user_prompt: str)->str:
#     PLANNER_PROMPT=f""" 
#     You are the PLANNER agent. Convert the user prompt into a COMPLETE engineering project plan
#     User request: {user_prompt}
#     """

#     return PLANNER_PROMPT

def router_prompt(user_prompt: str) -> List[Dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are an expert query classifier. Your job is to analyze the user's prompt "
                "and route it to the correct workflow."
                "\n"
                "If the user wants to build, create, or generate something (e.g., 'build a UI', 'make a tool'), "
                "route to 'build'.\n"
                "If the user provides an error message, stack trace, or asks to 'fix' or 'debug' code, "
                "route to 'debug'.\n"
                "If the user is asking a question, wants to 'learn' something, or needs an explanation, "
                "route to 'learn'."
            )
        },
        {
            "role": "user",
            "content": f"User prompt: {user_prompt}"
        }
    ]

def planner_prompt(user_prompt: str) -> List[Dict[str, str]]:
    """A prompt for the planner agent."""
    
    # The default tech stack
    DEFAULT_TECH_STACK = "MongoDB, React, and Flask"
    
    return [
        {
            "role": "system",
            "content": f"""
You are an expert software development planner. Your job is to take a user's request
and create a high-level plan to build it.

**CRITICAL CONTEXT:**
1.  Analyze the user's request: "{user_prompt}"
2.  If the user **does not** specify a technology stack (e.g., "in Node.js" or "using Vue"),
    you **MUST** assume the default stack.
3.  The default stack is: **{DEFAULT_TECH_STACK}**.
4.  Your plan **MUST** be based on this technology stack (either the user's
    specified one or the default).
5.  The output must be a valid JSON object matching the `Plan` Pydantic model.
6.  The `project_goal` in your plan **MUST** restate the user's goal *including* the
    chosen tech stack.

**Example for 'make a todo app':**
{{
    "project_goal": "Build a simple To-Do application using Flask, React, and MongoDB.",
    "steps": [
        "Initialize project repository and scaffolding for Flask backend and React frontend.",
        "Design the MongoDB schema for 'users' and 'todos' collections.",
        "Implement Flask API endpoints for CRUD operations (Create, Read, Update, Delete) on todos.",
        "Create the React frontend components (e.g., TodoList, TodoItem, AddTodoForm).",
        "Connect the React frontend to the Flask API to fetch and manage todos."
    ]
}}
            """
        },
        {
            "role": "user",
            "content": user_prompt
        }
    ]

def architect_prompt(plan: str)->str:
    ARCHITECT_PROMPT=f""" 
You are the ARCHITECT agent. Given this project plan, break it down into explicit engineering tasks.

RULES:

- For each FILE in the plan, create one or more IMPLEMENTATION TASKS.
- In each task description:
  * Specify exactly what to implement.
  * Name the variables, functions, classes, and components to be defined.
  * Mention how this task depends on or will be used by previous tasks.
  * Include integration details: imports, expected function signatures, data flow
- Order tasks so that dependencies are implemented first.
- Each step must be SELF-CONTAINED but also carry FORWARD the relevant context fro

Project Plan:
{plan}
"""
    return ARCHITECT_PROMPT

def research_prompt(task_description: str, project_plan: Plan) -> str:
    """A prompt for the researcher agent."""
    RESEARCH_PROMPT = f"""
    You are an expert research assistant. Your sole purpose is to generate search queries
    for a given programming task, within the context of a larger project.

    **Overall Project Goal:** "{project_plan.project_goal}"
    **Specific Task to Research:** "{task_description}"

    **CRITICAL INSTRUCTIONS:**
    1.  Your queries **MUST** be focused on the technologies mentioned in the
        **Overall Project Goal** (e.g., Flask, React, MongoDB).
    2.  Generate 3-5 queries to solve **only** the **Specific Task**.
    3.  You **MUST** call the `ResearchQueries` tool.
    4.  Your response **MUST** be ONLY a single, valid JSON object.

    Example Task: "Initialize project repository"
    Example Project Goal: "Build a simple web app with Flask and React"
    Example Response:
    {{"queries": ["how to set up a Flask project structure", "best .gitignore for Flask and React app", "creating a simple Flask application with routes"]}}
    """
    return RESEARCH_PROMPT

def coder_prompt(plan: Plan, task_plan: TaskPlan, context: str) -> List[Dict[str, str]]:
    """A prompt for the coding agent."""
    
    # For simplicity, we'll just code the first task.
    # A real loop would iterate through these.
    current_task = task_plan.implementation_steps[0]
    
    return [
        {
            "role": "system",
            "content": f"""
You are an expert programmer. Your job is to write code to complete a given task,
based on a high-level plan and retrieved documentation.

**Overall Project Goal:**
{plan.project_goal}

**Retrieved Documentation / Context:**
---
{context}
---

**Your Current Task:**
{current_task['task_description']}
{current_task['details']}

**Instructions:**
1.  Analyze the project goal, context, and your current task.
2.  Write the necessary code to implement **only** the current task.
3.  Ensure the code is correct, clean, and follows best practices.
4.  You **MUST** output your response in the `GeneratedCode` JSON format.
5.  Provide the complete code for each file, including imports.
6.  Use file paths relative to the project root (e.g., 'app.py', 'src/utils.py').
            """
        },
        {
            "role": "user",
            "content": f"Please generate the code for the task: {current_task['task_description']}"
        }
    ]