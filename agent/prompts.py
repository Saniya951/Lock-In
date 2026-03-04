from typing import List, Dict
from states import *
import json

# stack specific rules to build and test 
ARCHITECT_RULES = {
    "python_script": """
        - ENVIRONMENT: Pure Python.
        - FOLDER STRUCTURE: Flat directory. All files in the root.
        - DEPENDENCY FILE: `requirements.txt` only. You MUST generate tasks to create this.
        - ORDER: Ensure the order makes sense (Config -> Core Logic -> UI Components).    
    """,
    "react_only": """
        - ENVIRONMENT: React using Vite.
        - SCAFFOLDING AWARENESS: The workspace ALREADY CONTAINS boilerplate `index.html`, `src/main.jsx`, `package.json`, and `vite.config.js`. DO NOT generate tasks to create these files.
        - TASK GENERATION: Your task queue should start with modifying `src/App.jsx` and adding new components. If new npm packages are needed, create a task to MODIFY the existing `package.json`.
        - FILE EXTENSIONS: All new React components MUST use `.jsx` (e.g., `App.jsx`). DO NOT use `.js` for React components.
        - ORDER: Ensure the order makes sense (Core Logic -> UI Components).

    """,
    "react_flask": """
        - ENVIRONMENT: Full-stack. React Frontend (Vite) + Python/Flask Backend.
        - FOLDER STRUCTURE: You MUST split the app into two root folders: `frontend/` and `backend/`.
        - FRONTEND SCAFFOLDING: The `frontend/` directory ALREADY CONTAINS boilerplate `index.html`, `src/main.jsx`, `package.json`, and `vite.config.js`. DO NOT generate tasks to create these.
        - FRONTEND TASKS: Start by modifying `frontend/src/App.jsx`. If new npm packages are needed create a task to MODIFY `frontend/package.json`.
        - BACKEND TASKS: The `backend/` directory is EMPTY. You must generate all tasks to create `requirements.txt`, `app.py`, and routing logic from scratch.
        - FILE EXTENSIONS: All new React components MUST use `.jsx` (e.g., `App.jsx`). DO NOT use `.js` for React components.
    """,
    "node_backend": """
        - ENVIRONMENT: Pure JavaScript/Node.js.
        - FOLDER STRUCTURE: `src/` directory for logic, `src/routes/`, `src/controllers/`.
        - DEPENDENCY FILE: `package.json` in the root.
        - CRITICAL BOILERPLATE: MUST include "scripts": { "test": "vitest run" } in package.json.
        - CRITICAL DEPENDENCIES: MUST include `vitest` and `supertest` in devDependencies. ABSOLUTELY DO NOT install `jest`.
    """,
    "unknown": "Use standard software development best practices."
}

CODER_RULES = {
    "python_script": """
        - ENVIRONMENT: Pure Python.
        - FOLDER STRUCTURE: Flat directory. All files in the root.
        - DEPENDENCY FILE: `requirements.txt` only. 
    """,
    "react_only": """
        - ENVIRONMENT: React using Vite.
        - SYNTAX: Use modern functional components and Hooks (useState, useEffect).
        - IMPORTS: Use ES modules (`import`/`export`). Do NOT use CommonJS (`require`).
        - CSS: Assume standard CSS is available if requested, but focus on the component logic.
        - FILE EXTENSIONS: React components MUST be written as JSX.
    """,
    "react_flask": """
        - ENVIRONMENT: Full-stack. React Frontend (Vite) + Python/Flask Backend.
        - FRONTEND: React using Vite. Use functional components and ES module imports.
        - BACKEND: Python/Flask. 
        - FILE EXTENSIONS: All React frontend components MUST use `.jsx`.
        - API CALLS: If writing frontend API calls, assume the Flask backend is available via relative API routes or a configured proxy.
        - CORS: If writing the Flask backend, ensure `flask-cors` is utilized so the React frontend can communicate with it.
    """,
    "node_backend": """
        - ENVIRONMENT: Pure JavaScript/Node.js.
        - FOLDER STRUCTURE: `src/` directory for logic, `src/routes/`, `src/controllers/`.
        - DEPENDENCY FILE: `package.json` in the root.
        - CRITICAL BOILERPLATE: MUST include "scripts": { "test": "vitest run" } in package.json.
        - CRITICAL DEPENDENCIES: MUST include `vitest` and `supertest` in devDependencies. ABSOLUTELY DO NOT install `jest`.
    """,
    "unknown": "Use standard software development best practices."
}

TEST_RULES = {
    "python_script": """
        - TESTING FRAMEWORK: Use `pytest`. 
        - FILE NAMING: Test files must start with `test_` (e.g., `test_main.py`).
    """,
    "react_only": """
        - TESTING FRAMEWORK: Use `vitest` and `@testing-library/react`. 
        - FILE NAMING: Test files must end in `.test.jsx`. DO NOT use `.js`.
        - FOLDER STRUCTURE (CO-LOCATION): Place the test file in the EXACT SAME directory as the component it tests. Do not create a separate tests folder.
        - CRITICAL IMPORTS: You MUST explicitly import `describe`, `it`, and `expect` from `vitest` at the top of every test file.
        - DOM ASSERTIONS: You MUST explicitly import `@testing-library/jest-dom` at the top of every test file to use DOM matchers like `.toBeInTheDocument()`.
        - CRITICAL MOCKING RULE: DO NOT use the `jest` object. Use Vitest's `vi` object (e.g., `vi.fn()`). ABSOLUTELY DO NOT import `@jest/globals` or `jest`. The ONLY time you are allowed to type the word "jest" is when importing `@testing-library/jest-dom`.""",    
    "node_backend": """
        - TESTING FRAMEWORK: Use `vitest` and `supertest`. ABSOLUTELY DO NOT use `jest`. 
        - FILE NAMING: Test files must end in `.test.js`.
    """,
    "react_flask": """
        - BACKEND TESTING: Use `pytest` inside the `backend/` folder. Test files start with `test_`.
        - FRONTEND TESTING: Use `vitest` and `@testing-library/react`. 
        - FRONTEND FOLDER STRUCTURE: Co-locate React tests next to their components (e.g., `frontend/src/Button.jsx` and `frontend/src/Button.test.jsx`).
        - FRONTEND FILE NAMING: Frontend test files MUST end in `.test.jsx`. DO NOT use `.js`.
        - FRONTEND IMPORTS: MUST import `describe`, `it`, `expect` from `vitest`, AND import `@testing-library/jest-dom` at the top of every test file.
        - CRITICAL MOCKING RULE: DO NOT use the `jest` object. Use Vitest's `vi` object (e.g., `vi.fn()`). ABSOLUTELY DO NOT import `@jest/globals` or `jest`. The ONLY time you are allowed to type the word "jest" is when importing `@testing-library/jest-dom`.""",
    "unknown": "Use standard testing frameworks for the language."
}

def router_prompt(user_prompt: str) -> List[Dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                """You are an expert query classifier. Your job is to analyze the user's prompt and route it to the correct workflow.
                If the user wants to build, create, or generate something (e.g., 'build a UI', 'make a tool'), route to 'build'.
                If the user provides an error message, stack trace, or asks to 'fix' or 'debug' code, route to 'debug'.\n"
                If the user is asking a question, wants to 'learn' something, or needs an explanation, route to 'learn'."""
            )
        },
        {
            "role": "user",
            "content": f"User prompt: {user_prompt}"
        }
    ]

def planner_prompt(user_prompt: str) -> List[Dict[str, str]]:
    
    return [
        {
            "role": "system",
            "content": f"""
You are a Lead Technical Planner. Your job is to create a high-level roadmap for a software project.

**Your Goal:**
Take the user's request and turn it into a clear, step-by-step execution strategy.

**CRITICAL RULES:**
1. **Analyze the Request:** Understand the core functionality.
2. **Select the Tech Stack:** You MUST choose one of the following:
   - `react_flask`: For full-stack web apps (React Frontend + Python/Flask Backend).
   - `python_script`: For data analysis, automation, CLI tools, or simple scripts.
   - `react_only`: For pure frontend logic or static sites.
   - `node_backend`: For pure Node.js/Express APIs.
3. **Step-by-Step Plan:** Break the project into 4-6 high-level milestones.
   - Step 1 is always "Setup & Configuration".
   - Final steps should be "Refinement".

**Output Schema Template:**
You must return a valid JSON object matching this exact structure. Do not use markdown blocks.
{{
    "project_goal": "<A clear, concise summary of the application to be built>",
    "tech_stack": "<MUST BE EXACTLY ONE OF: react_flask, python_script, react_only, node_backend>",
    "steps": [
        "<Step 1: Setup & Configuration for the chosen stack>",
        "<Step 2: Core implementation...>",
        "<...>",
        "<Final Step: Refinement>"
    ]
}}
            """
        },
        {
            "role": "user",
            "content": f"Request: {user_prompt}"
        }
    ]

def feature_architect_prompt(user_prompt: str, tech_stack: str, completed_files: list) -> List[Dict[str, str]]:
    
    # Reuse your existing architect rules so it understands the boundaries of the stack
    architect_rules = ARCHITECT_RULES.get(tech_stack, ARCHITECT_RULES["unknown"])
    
    return [
        {
            "role": "system",
            "content": f"""
You are a Lead Feature Architect. 
An application has already been built and scaffolded. Your job is to analyze the user's new feature request and generate a list of file modification tasks to implement it.

**The Stack:** {tech_stack}
**Existing Files in Workspace:** {completed_files}

**ARCHITECTURAL RULES:**
{architect_rules}

**CRITICAL INSTRUCTIONS:**
1. **Delta Updates Only:** Do NOT generate tasks to recreate files that already exist (like `index.html` or `vite.config.js`) unless the user's specific feature requires modifying them.
2. **File Modifications:** If a feature requires changing an existing file (e.g., adding a button to *.jsx), create a task for *.jsx with a detailed `task_description` of what needs to be added.
3. **New Files:** If the feature requires a new component or backend route, create a task for that new file.
4. **Dependencies:** If the feature requires new npm/pip packages, create a task to update requirements.txt/ package.json files.

Output a valid JSON containing `implementation_steps` and `dependencies`.
"""
        },
        {"role": "user", "content": f"New Feature Request: {user_prompt}"}
    ]

def architect_prompt(plan) -> List[Dict[str, str]]:
    """Prompt 1: Build Structure & Dependencies"""
    architect_rules = ARCHITECT_RULES.get(plan.tech_stack, ARCHITECT_RULES["unknown"])
    return [
        {
            "role": "system",
            "content": f"""
You are a Lead Software Architect. 
Your goal is to break down the plan into a **granular list of FILE CREATION tasks** and **DEPENDENCIES**.

**Project Goal:** {plan.project_goal}
**Stack:** {plan.tech_stack}
**Steps:** {plan.steps}
**CRITICAL ARCHITECT RULES:**
{architect_rules}

**Instructions:**
1. **File List:** Translate high-level steps into specific files (app.py, App.jsx).
 **CRITICAL RULE:** Do NOT include test files here (e.g., `test_*.py`, `*.test.jsx`, `spec.jsx`).
2. **Dependencies:** List ONLY the package names needed for `npm install` or `pip install`. 
   - DO NOT include version numbers. 
   - Example: ["flask", "flask-cors", "requests"] OR ["react", "axios", "framer-motion"].
3.DO NOT output abstract tasks like "Design the UI" or "Run npx create-react-app".
4. Instead output specific file tasks according to the Project Goal . 

**Output Format:**
Return a JSON with `implementation_steps` and `dependencies`.
"""
        },
        {"role": "user", "content": "Generate the build manifest."}
    ]

def qa_architect_prompt(plan, files_context:str) -> List[Dict[str, str]]:
    """Prompt 2: Test Strategy based on the Build Manifest"""
    architect_rules = ARCHITECT_RULES.get(plan.tech_stack, ARCHITECT_RULES["unknown"])
    test_rules = TEST_RULES.get(plan.tech_stack, TEST_RULES["unknown"])
        
    return [
        {
            "role": "system",
            "content": f"""
You are a Lead QA Engineer. 
Your goal is to design a **Unit Testing Strategy** based on the files the Architect has planned.

**The Stack:** {plan.tech_stack}
**Planned Source Files:**{files_context}

**FOLDER STRUCTURE RULES (Where to place files):**
{architect_rules}

**TESTING RULES (How to write tests):**
{test_rules}

**Instructions:**
1.Create a `QATask` for every major logic/component file in the list above.
2.DO NOT generate tests for configuration files like package.json, requirements.txt, .gitignore, or HTML files.
3.DO NOT generate tests for boilerplate files like index.html, main.jsx etc.
3.ABSOLUTELY NO SOURCE CODE. You are only designing test files.
4.**Scenarios:** List 3-5 specific edge cases to test for each file.

**Output Format:**
Return a JSON with `qa_tasks`.
"""
        },
        {"role": "user", "content": "Generate the QA manifest."}
    ]

def construct_researcher_prompt(tech_stack: str, task_queue: list, project_goal: str) -> str:
    """Constructs the prompt for the Dedicated Researcher Node."""
    
    # Format the queue into a readable string
    tasks_str = "\n".join([f"- File: {t['file_name']} | Task: {t['task_description']}" for t in task_queue])
    
    return f"""
    You are a Lead Research Strategist. 
    Your job is to analyze a queue of coding tasks and determine if external documentation is required to complete them successfully.
    CRITICAL  RULES:
1. THE CONFIG BAN: You MUST set `needs_search` to False for ALL dependency manifests and configuration files. This includes, but is not limited to: `package.json`, `requirements.txt`, `vite.config.js`, `vite.config.ts`, `tailwind.config.js`, `eslint`, `.env`, and `index.html`. 

2. THE FOUNDATION BAN: You MUST set `needs_search` to False for foundational programmatic logic (e.g., standard React `useState`/`useEffect`, basic Flask routing, straightforward data parsing).

3. THE STANDARD LIBRARY BAN: You MUST set `needs_search` to False for built-in language libraries that require no installation. For Python, this includes `os`, `sys`, `tkinter`, `unittest`, `mock`, `math`, `json`, etc. 

4. QUERY ENGINEERING: When `needs_search` is True, your `search_query` MUST be optimized for finding official documentation, NOT beginner tutorials. 
   - BAD QUERY: "how to use react router"
   - GOOD QUERY: "React Router v6 createBrowserRouter exact syntax and API reference"
   - BAD QUERY: "flask database setup"
   - GOOD QUERY: "Flask-SQLAlchemy model definition query reference"

INSTRUCTIONS:
Evaluate every file in the pending tasks list against the rules above. Output your decisions mapping exactly to the filenames provided.
    
    PROJECT GOAL: {project_goal}
    TECH STACK: {tech_stack}
    
    PENDING TASKS:
    {tasks_str}
    """

def construct_coder_prompt(filename: str, task_desc: str, doc_context: str, 
                           mode: str, existing_code: str = "", error_report: str = "", 
                           tech_stack: str ="", user_prompt: str = "") -> str:
    """Constructs the prompt for the coder agent."""
    
    file_specific_rules = ""
    filename_lower = filename.lower()
    
    #npm and react rules (for vite)
    if "package.json" in filename_lower:
        file_specific_rules = """
        CRITICAL `package.json` RULES:
        1. Output VALID JSON only.
        2. Include all NPM packages requested in the task description.
        3. MANDATORY: You MUST additionally include all scripts, frameworks, and configuration blocks (like Vite, Vitest) required by the BUILD RULES above.
        4. DO NOT write Python dependencies here.
        """
    #vite config rules
    elif "vite.config" in filename_lower:
        file_specific_rules = """
        CRITICAL `vite.config` RULES:
        1. Output valid JavaScript/ESM configuration for Vite.
        2. MANDATORY: Ensure you configure the `test` block for Vitest (e.g., environment: 'jsdom') and import `@vitejs/plugin-react`.
        """

    elif "requirements.txt" in filename_lower:
        file_specific_rules = """
        CRITICAL `requirements.txt` RULES:
        1. Output standard pip format (one package per line).
        2. DO NOT put JavaScript, Vite, Node, NPM packages, or JSON configuration. Pure Python ONLY.
        3. DO NOT add built-in Python libraries (math, os, sys).
        4. If no external dependencies are needed, YOU MUST RETURN EXACTLY AND ONLY THIS COMMENT: `# No dependencies required`. Do not output any other text or explanations."""

    coder_rules = CODER_RULES.get(tech_stack, CODER_RULES["unknown"])

    prompt_header = f"""
        Overarching Goal: {user_prompt}
    """

    if mode == "fix":
        return f"""
        {prompt_header}
        You are a Senior Debugger.

        GENERAL RULES: {coder_rules}
        FILE SPECIFIC RULES: {file_specific_rules}
        TARGET FILE: {filename}
        
        CURRENT CODE:
        ```
        {existing_code}
        ```
        
        ERROR REPORT:
        {error_report}
        
        TASK: Fix the error in the code above.

        OUTPUT FORMAT:
        Return ONLY the raw file content. Do NOT wrap it in ```markdown blocks. No explanations.
        """
    
    elif mode == "modify":
        return f"""
        {prompt_header}
        You are a Senior Developer.

        GENERAL RULES: {coder_rules}
        FILE SPECIFIC RULES: {file_specific_rules}
        TARGET FILE: {filename}
        
        CURRENT SCAFFOLDED CODE:
        ```
        {existing_code}
        ```
        
        TASK DESCRIPTION:
        {task_desc}
        
        TASK: This file already exists from a boilerplate template. Your job is to UPDATE or APPEND to this existing code to fulfill the task description. 
        - Do NOT delete the foundational configuration.
        - For JSON files, merge the new data seamlessly.
        - For JS/JSX files, inject the required imports and logic without breaking the existing structure.

        OUTPUT FORMAT:
        Return ONLY the full, updated raw file content. Do NOT wrap it in ```markdown blocks. No explanations.
        """

    else: # mode == "build"
        return f"""
        {prompt_header}
        You are a senior developer

        BUILD RULES: {coder_rules}
        FILE SPECIFIC RULES:{file_specific_rules}
        TARGET FILE: {filename}
        
        TASK DESCRIPTION:
        {task_desc}
        
        RELEVANT DOCS:
        {doc_context}
        
        OUTPUT FORMAT:
        Return ONLY the raw file content. Do NOT wrap it in ```markdown blocks. No explanations.
        """

def construct_qa_prompt(target_filename: str, source_code: str, scenarios: list,tech_stack:str) -> str:
    """Constructs the prompt for the QA/Test Generation Agent."""
    test_rules = TEST_RULES.get(tech_stack, TEST_RULES["unknown"])

    return f"""
    You are a Senior QA Automation Engineer.
    
    TASK: Write a robust unit test suite for the following source code.

    TEST RULES: {test_rules}
    
    SOURCE CODE ({target_filename}):
    ```
    {source_code}
    ```
    
    TESTING SCENARIOS REQUIRED:
    {json.dumps(scenarios, indent=2)}
    
    REQUIREMENTS:
    1. IMPORTS: Ensure you import the specific functions/classes from `{target_filename}` correctly.
    2. MOCKING: You MUST mock all external API calls. If the code uses `fetch`, you MUST explicitly mock it globally using `global.fetch = vi.fn(...)`. You MUST use Vitest's `vi` utility. NEVER use `jest`.
    3. OUTPUT: Return ONLY the code for the test file. No markdown, no explanations.
    """

def construct_evaluator_prompt(env_ok: bool, exit_code: int, logs: str) -> str:
    
    return f"""
    Analyze the following execution logs and classify the exact failure layer.
        
    ENVIRONMENT OK: {env_ok} (If False, this is guaranteed to be an INFRA error)
    EXIT CODE: {exit_code}
    
    RAW LOGS:
    {logs}
    
    Classify the error into one of the following categories:
    - infra: Dependency failures, pip/npm crashes, missing environment tools.
    - syntax: SyntaxErrors, IndentationErrors, or missing modules/imports.
    - runtime: The code ran but crashed (e.g., TypeError, AttributeError).
    - logical: The code ran perfectly, but failed a test assertion (wrong output).
    - timeout: The process exceeded the maximum time limit (infinite loop).
    """

def construct_debugger_prompt(error_category: str, category_instructions: str, current_error: str, 
                              formatted_history: str, relevant_context: str) -> str:

    return f"""
    You are a ruthless, precision-focused Senior Debugging Engineer.
    DO NOT build new features. DO NOT write project plans. Your ONLY job is to patch the exact errors provided.
    
    ERROR CATEGORY: {error_category.upper()}
    {category_instructions}
    
    CURRENT ERROR LOGS:
    {current_error}
    
    PAST ATTEMPTS:
    {formatted_history}
    
    RELEVANT CODE SNIPPETS:
    {relevant_context}
    
    TASK:
    Analyze the ERROR LOGS. For EACH specific error mentioned in the logs, create a targeted fix task.
    
    CRITICAL RULES:
    1. TARGET ALL FAILED FILES: If the logs mention multiple files, you MUST generate a separate task for EACH file.
    2. NO NEW FEATURES: You are fixing broken code, not writing it from scratch. Address the bug and stop.
    3. If the current error is the same as a previous error, your previous fix FAILED. Try a DIFFERENT approach.
    4. NO DIAGNOSTIC SCRIPTS: Do NOT create files like `debug.py` or `test.py`. Fix the broken source files directly.
    """

def explainer_prompt(run_status: str, files_content: str, user_prompt: str) -> list:
    return [
        {
            "role": "system",
            "content": (
                f"""You are the Explainer Agent in an autonomous coding framework.
                Your job is to read the raw code of the files created/modified in the current turn and provide a concise,easy-to-understand summary of what was built, changed, or attempted to the user.
                RULES:
                1. Keep it brief. Do not regurgitate the code.
                2. Explain architecture and logic in context to the user prompt {user_prompt}."""
            )
        },
        {
            "role": "user",
            "content": f"The pipeline finished with status: {run_status.upper()}\n\nHere are the files modified in this turn:\n{files_content}"
        }
    ]