from typing import List, Dict
from states import *
import json

# stack specific rules to build and test 
BUILD_RULES = {
    "python_script": """
        - ENVIRONMENT: Pure Python.
        - FOLDER STRUCTURE: Flat directory. All files in the root.
        - DEPENDENCY FILE: `requirements.txt` only.
    """,
    "react_only": """
        - ENVIRONMENT: React using Vite.
        - FOLDER STRUCTURE: Vite standard. `index.html`, `package.json`, and `vite.config.js` in the root. Source code in `src/`.
        - FILE EXTENSIONS: All React components MUST use `.jsx` (e.g., `App.jsx`). DO NOT use `.js` for React components.
        - DEPENDENCY FILE: `package.json` in the root.
        - CRITICAL CONFIG: You MUST generate a `vite.config.js` file that imports `@vitejs/plugin-react` and configures the `test` environment to use `jsdom`.
        - CRITICAL SCRIPTS: In `package.json`, the scripts MUST include: "dev": "vite", "build": "vite build", and "test": "vitest run".
        - CRITICAL DEPENDENCIES: You MUST include `react` and `react-dom` in standard dependencies. You MUST include `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom` in devDependencies.
    """,
    "node_backend": """
        - ENVIRONMENT: Pure JavaScript/Node.js.
        - FOLDER STRUCTURE: `src/` directory for logic, `src/routes/`, `src/controllers/`.
        - DEPENDENCY FILE: `package.json` in the root.
        - CRITICAL BOILERPLATE: MUST include "scripts": { "test": "jest --passWithNoTests" } in package.json.
    """,
    "react_flask": """
        - ENVIRONMENT: Full-stack. React Frontend (Vite) + Python/Flask Backend.
        - FOLDER STRUCTURE: You MUST split the app into two root folders: `frontend/` and `backend/`.
        - DEPENDENCY FILES: Create `frontend/package.json` AND `backend/requirements.txt`.
        - FILE EXTENSIONS: All React frontend components MUST use `.jsx`.
        - FRONTEND CONFIG: You MUST generate a `frontend/vite.config.js` file using `@vitejs/plugin-react` and `jsdom` for testing.
        - FRONTEND SCRIPTS: In `frontend/package.json`, include: "dev": "vite", "build": "vite build", and "test": "vitest run".
        - FRONTEND DEPENDENCIES: MUST include `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`.
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
    """,
    "node_backend": """
        - TESTING FRAMEWORK: Use `jest` and `supertest`. 
        - FILE NAMING: Test files must end in `.test.js`.
    """,
    "react_flask": """
        - BACKEND TESTING: Use `pytest` inside the `backend/` folder. Test files start with `test_`.
        - FRONTEND TESTING: Use `vitest` and `@testing-library/react`. 
        - FRONTEND FOLDER STRUCTURE: Co-locate React tests next to their components (e.g., `frontend/src/Button.jsx` and `frontend/src/Button.test.jsx`).
        - FRONTEND FILE NAMING: Frontend test files MUST end in `.test.jsx`. DO NOT use `.js`.
        - FRONTEND IMPORTS: MUST import `describe`, `it`, `expect` from `vitest`, AND import `@testing-library/jest-dom` at the top of every test file.""",
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

def architect_prompt(plan) -> List[Dict[str, str]]:
    """Prompt 1: Build Structure & Dependencies"""
    build_rules = BUILD_RULES.get(plan.tech_stack, BUILD_RULES["unknown"])
    return [
        {
            "role": "system",
            "content": f"""
You are a Lead Software Architect. 
Your goal is to break down the plan into a **granular list of FILE CREATION tasks** and **DEPENDENCIES**.

**Project Goal:** {plan.project_goal}
**Stack:** {plan.tech_stack}
**Steps:** {plan.steps}
**CRITICAL BUILD RULES:**
{build_rules}

**Instructions:**
1. **File List:** Translate high-level steps into specific files (package.json, app.py, App.jsx).
 **CRITICAL RULE:** Do NOT include test files here (e.g., `test_*.py`, `*.test.jsx`, `spec.jsx`).
2. **Dependencies:** List ONLY the package names needed for `npm install` or `pip install`. 
   - DO NOT include version numbers. 
   - Example: ["flask", "flask-cors", "requests"] OR ["react", "axios", "framer-motion"].
3.DO NOT output abstract tasks like "Design the UI" or "Run npx create-react-app".
4. Instead output specific file tasks. 
5. For `related_docs_topic`, be specific (e.g., "React Functional Components", "CSS Flexbox", "Node.js Express Setup").
6. Ensure the order makes sense (Configs first -> Core Logic -> UI Components).

**Output Format:**
Return a JSON with `implementation_steps` and `dependencies`.
"""
        },
        {"role": "user", "content": "Generate the build manifest."}
    ]

def qa_architect_prompt(plan, files_context:str) -> List[Dict[str, str]]:
    """Prompt 2: Test Strategy based on the Build Manifest"""
    build_rules = BUILD_RULES.get(plan.tech_stack, BUILD_RULES["unknown"])
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
{build_rules}

**TESTING RULES (How to write tests):**
{test_rules}

**Instructions:**
1.Create a `QATask` for every major logic/component file in the list above.
2.DO NOT generate tests for configuration files like package.json, requirements.txt, .gitignore, or HTML files.
3.ABSOLUTELY NO SOURCE CODE. You are only designing test files.
4.**Scenarios:** List 3-5 specific edge cases to test for each file.

**Output Format:**
Return a JSON with `qa_tasks`.
"""
        },
        {"role": "user", "content": "Generate the QA manifest."}
    ]


def construct_coder_prompt(filename: str, task_desc: str, doc_context: str, 
                           mode: str, existing_code: str = "", error_report: str = "", tech_stack: str ="") -> str:
    """Constructs the prompt for the coder agent."""
    
    file_specific_rules = ""
    filename_lower = filename.lower()
    
    #npm and react rules (for vite)
    if "package.json" in filename_lower:
        file_specific_rules = """
        CRITICAL `package.json` RULES:
        1. Output VALID JSON only.
        2. Include all NPM packages requested in the task description.
        3. MANDATORY: You MUST additionally include all scripts, frameworks, and configuration blocks (like Vite, Vitest) required by the BUILD RULES below.
        4. DO NOT write Python dependencies here.
        """
        
    #pip and python rules
    elif "requirements.txt" in filename_lower:
        file_specific_rules = """
        CRITICAL `requirements.txt` RULES:
        1. Output standard pip format (one package per line).
        2. DO NOT put JavaScript, Vite, Node, NPM packages, or JSON configuration in this file. Pure Python packages ONLY.
        3. Include all Python packages requested in the task description.
        4. DO NOT add built-in Python libraries (math, os, sys).
        5. If no external dependencies are needed, leave the file completely blank.
        """
        
    #vite config rules
    elif "vite.config" in filename_lower:
        file_specific_rules = """
        CRITICAL `vite.config` RULES:
        1. Output valid JavaScript/ESM configuration for Vite.
        2. MANDATORY: Ensure you configure the `test` block for Vitest (e.g., environment: 'jsdom') and import `@vitejs/plugin-react`.
        """

    build_rules = BUILD_RULES.get(tech_stack, BUILD_RULES["unknown"])

    if mode == "fix":
        return f"""
        You are a Senior Debugger.

        BUILD RULES: {build_rules}
        
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
        {file_specific_rules}
        
        RELEVANT DOCS:
        {doc_context}
        
        OUTPUT FORMAT:
        Return ONLY the raw file content. Do NOT wrap it in ```markdown blocks. No explanations.
        """
    
    else: # mode == "build"
        return f"""
        You are a Senior Developer.

        BUILD RULES: {build_rules}
        
        TARGET FILE: {filename}
        
        TASK DESCRIPTION:
        {task_desc}
        {file_specific_rules}
        
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
    2. MOCKING: If the code calls external APIs or databases, you MUST mock them.
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
