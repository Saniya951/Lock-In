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
    
    # Analyze if tech stack is specified
    tech_keywords = ["react", "flask", "mongodb", "node", "vue", "django", "express", "python", "javascript", "html", "css"]
    mentioned_tech = [tech for tech in tech_keywords if tech.lower() in user_prompt.lower()]
    
    if mentioned_tech:
        inferred_stack = f"Based on mentioned technologies: {', '.join(mentioned_tech)}"
    else:
        inferred_stack = "No specific technologies mentioned, keep it focused on the request."
    
    return [
        {
            "role": "system",
            "content": f"""
You are an expert software development planner. Your job is to take a user's request
and create a high-level plan to build it.

**CRITICAL CONTEXT:**
1.  Analyze the user's request: "{user_prompt}"
2.  {inferred_stack}
3.  If no technologies are specified, do not assume a full stack—keep the plan minimal and directly address the request.
4.  The output must be a valid JSON object matching the `Plan` Pydantic model.
5.  The `project_goal` must restate the user's goal accurately.

**Example for 'make a todo app' (no tech specified):**
{{
    "project_goal": "Build a simple To-Do application.",
    "steps": [
        "Create HTML structure for the todo list.",
        "Add JavaScript for adding/removing items.",
        "Style with CSS for basic appearance."
    ]
}}

**Example for 'build a React component' (tech specified):**
{{
    "project_goal": "Build a React component that displays a list of items.",
    "steps": [
        "Create a React component that renders a list from an array.",
        "Add props for the array and map over items.",
        "Export the component for use."
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
    current_task = task_plan.implementation_steps[0]  # Focus on React component task
    
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

def site_selection_prompt(user_prompt: str, task_description: str, plan: Plan, supported_sites: List[str]) -> str:
    """A prompt for selecting relevant documentation sites."""
    SITE_SELECTION_PROMPT = f"""
    You are an expert at analyzing software development requests. Based on the user's project prompt, the current task, and the overall project plan,
    determine which documentation sites are most relevant for research.

    User prompt: {user_prompt}
    Current task: {task_description}
    Project plan: {plan.project_goal}
    Supported sites: {supported_sites}

    Return a list of site names from the supported sites that are relevant to the task and plan. If none are relevant, return an empty list.
    Output must be a valid JSON object matching the `SiteSelection` Pydantic model.
    """
    return SITE_SELECTION_PROMPT