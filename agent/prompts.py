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
    """A prompt for the planner agent that enforces clear tech stack decisions."""
    
    return [
        {
            "role": "system",
            "content": f"""
You are a Lead Technical Planner. Your job is to create a high-level roadmap for a software project.

**Your Goal:**
Take the user's request and turn it into a clear, step-by-step execution strategy.

**CRITICAL RULES:**
1. **Analyze the Request:** Understand the core functionality.
2. **Define the Tech Stack:** - If the user specifies tech (e.g., "React"), use it.
   - If NO tech is specified, **YOU MUST CHOOSE** the best standard tools for the job (e.g., HTML/JS for simple things, React/Flask for apps). 
   - *Do not leave it ambiguous.* explicitly state: "Using React for frontend, Flask for backend."
3. **Step-by-Step Plan:** Break the project into 4-6 high-level milestones.
   - Step 1 is always "Setup & Configuration".
   - Final steps should be "Refinement".

**Example Output (User: "Create a snake game"):**
{{
    "project_goal": "Build a classic Snake game using Python and Pygame.",
    "steps": [
        "Setup Python environment and install Pygame.",
        "Initialize the game window and main game loop.",
        "Implement snake movement and control logic.",
        "Implement food spawning and collision detection.",
        "Add score tracking and game over states."
    ]
}}
            """
        },
        {
            "role": "user",
            "content": f"Request: {user_prompt}"
        }
    ]

def architect_prompt(plan: str)->str:
    ARCHITECT_PROMPT=[
        {
            "role": "system",
            "content": f"""
You are a Lead Software Architect. 
Your goal is to break down a high-level project plan into a **granular list of FILE CREATION tasks**.

**Project Goal:** {plan.project_goal}

**The Plan:**
{plan.steps}

**Instructions:**
1. You must translate every high-level step into specific files that need to be created.
2. DO NOT output abstract tasks like "Design the UI" or "Run npx create-react-app".
3. Instead, output specific file tasks:
   - "Create package.json with React dependencies"
   - "Create public/index.html"
   - "Create src/index.js"
   - "Create src/App.js"
4. For `related_docs_topic`, be specific (e.g., "React Functional Components", "CSS Flexbox", "Node.js Express Setup").
5. Ensure the order makes sense (Configs first -> Core Logic -> UI Components).

**Example Output:**
- file_name: "package.json"
  task_description: "Define standard React dependencies and scripts."
  related_docs_topic: "NPM Package Json"

- file_name: "src/App.js"
  task_description: "Main component structure with routing."
  related_docs_topic: "React Router"
"""
        },
        {
            "role": "user",
            "content": "Generate the detailed file list now."
        }
    ]
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

def construct_coder_prompt(filename: str, task_desc: str, doc_context: str, 
                           mode: str, existing_code: str = "", error_report: str = "") -> str:
    """Constructs the prompt for the coder agent."""
    
    if mode == "fix":
        return f"""
        You are a Senior Debugger.
        
        TARGET FILE: {filename}
        
        CURRENT CODE:
        ```
        {existing_code}
        ```
        
        ERROR REPORT:
        {error_report}
        
        TASK:
        Fix the error in the code above. 
        Use the provided documentation if needed.
        
        RELEVANT DOCS:
        {doc_context}
        
        OUTPUT FORMAT:
        Return ONLY the full corrected code content. No markdown formatting, no explanation.
        """
    
    else: # mode == "build"
        return f"""
        You are a Senior Developer.
        
        TARGET FILE: {filename}
        
        TASK DESCRIPTION:
        {task_desc}
        
        RELEVANT DOCS:
        {doc_context}
        
        OUTPUT FORMAT:
        Return ONLY the code content for this file. No markdown formatting, no explanation.
        """

# def coder_prompt(plan: Plan, task_plan: TaskPlan, context: str) -> List[Dict[str, str]]:
#     """A smart prompt for the coding agent that handles full builds and partial fixes."""
    
#     # 1. DETECT FIX MODE
#     # We check if the context contains the specific error header we added in the agent
#     is_fix_mode = "CRITICAL FEEDBACK" in context

#     # 2. PREPARE TASKS
#     # Instead of just step[0], we format ALL steps into a readable list
#     all_tasks = ""
#     for i, step in enumerate(task_plan.implementation_steps, 1):
#         all_tasks += f"{i}. {step['task_description']}\n   Details: {step['details']}\n"

#     # 3. DYNAMIC INSTRUCTIONS
#     if is_fix_mode:
#         goal_instruction = """
#         *** FIX MODE ACTIVATED ***
#         The user has reported an error in your previous code (see 'CRITICAL FEEDBACK' below).
#         Your job is to PATCH the existing code to fix this error.
        
#         RULES FOR FIXING:
#         1. Analyze the feedback and determine which file(s) caused the error.
#         2. RETRIEVE the full content of those specific files from your memory/context.
#         3. OUTPUT ONLY THE FILES THAT NEED CHANGES. Do not regenerate files that are already correct.
#         4. If a file needs a small change, you must still output the FULL corrected content of that file.
#         """
#     else:
#         goal_instruction = """
#         *** FRESH BUILD MODE ***
#         Your job is to write the code for the ENTIRE project scope described below.
        
#         RULES FOR BUILDING:
#         1. Implement all tasks listed in the 'Implementation Steps'.
#         2. Create all necessary files (backend, frontend, configuration, etc.).
#         3. Ensure the code is production-ready, clean, and modular.
#         """

#     # 4. CONSTRUCT PROMPT
#     return [
#         {
#             "role": "system",
#             "content": f"""
# You are an expert full-stack developer (React & Flask).

# {goal_instruction}

# **Overall Project Goal:**
# {plan.project_goal}

# **Implementation Steps (Execute ALL of these):**
# {all_tasks}

# **Retrieved Documentation & Context:**
# ---
# {context}
# ---

# **Formatting Requirements:**
# 1. You **MUST** output your response in the `GeneratedCode` JSON format.
# 2. Ensure you provide the **COMPLETE** code for every file you output (no shortcuts like `// ... rest of code`).
# 3. Use strict relative file paths (e.g., 'server/app.py', 'client/src/App.js').
#             """
#         },
#         {
#             "role": "user",
#             "content": "Execute the plan. If fixing an error, output only the fixed files. If building from scratch, output the full application."
#         }
#     ]

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