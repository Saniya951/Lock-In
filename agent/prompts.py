def planner_prompt(user_prompt: str)->str:
    PLANNER_PROMPT=f""" 
    You are the PLANNER agent. Convert the user prompt into a COMPLETE engineering project plan
    User request: {user_prompt}
    """

    return PLANNER_PROMPT


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

def research_prompt(task_description: str) -> str:
    """A "bulletproof" prompt for the researcher agent."""
    RESEARCH_PROMPT = f"""
    You are an expert research assistant. Your sole purpose is to generate a list of search queries for a given programming task.

    **Task:** "{task_description}"

    **CRITICAL INSTRUCTIONS:**
    1.  You **MUST** call the `ResearchQueries` tool.
    2.  Your response **MUST** be ONLY a single, valid JSON object.
    3.  The JSON object **MUST** have a single key named "queries".
    4.  The value of "queries" **MUST** be a list of 3-5 string questions.
    5.  **DO NOT** add any explanatory text before or after the JSON object.
    6.  **DO NOT** wrap the JSON in markdown backticks (```json).

    Example of a perfect response:
    {{"queries": ["how to create a POST route in Flask", "Flask request object get JSON data"]}}
    """
    return RESEARCH_PROMPT