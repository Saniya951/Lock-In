from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_community.vectorstores import Chroma
from pydantic import BaseModel, Field
import json
import os
import re
import uuid
import time
import requests
from termcolor import cprint
from tavily import TavilyClient
from e2b_code_interpreter import Sandbox
from typing import List, Literal, Dict, Any 

from prompts import *
from states import * 
from memory import CodeMemory 
from sandbox_registry import get_sandbox_for_session, register_sandbox

from concurrent.futures import ThreadPoolExecutor

# Small pool is enough; HF API is the bottleneck anyway
embedding_executor = ThreadPoolExecutor(max_workers=2)


# different llms:
# llm = ChatGroq(model="openai/gpt-oss-120b")
# llm=ChatGroq(model="meta-llama/llama-4-scout-17b-16e-instruct")
# llm = ChatGroq(model="llama-3.1-8b-instant")
# test_llm = ChatGroq(model="mixtral-8x7b-32768")

llm = ChatGroq(model="llama-3.3-70b-versatile")


# imp!!!!! this is an absolute path. It dynamically finds exactly where graph.py lives on your hard drive and forces the output folder to be created right next to it, 
# completely ignoring where your terminal is currently pointing.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

DB_PATH = os.path.join(SCRIPT_DIR, "chroma_db") 

HF_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

#load vector db
cprint(f" Loading vector database from {DB_PATH}...", "yellow")
embeddings = HuggingFaceEndpointEmbeddings(repo_id=HF_EMBEDDING_MODEL)
db = Chroma(persist_directory=DB_PATH, embedding_function=embeddings)
retriever = db.as_retriever(search_kwargs={"k": 3})
cprint(" Vector database loaded successfully.", "green")

# initialize tavily
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
cprint(" Tavily client initialized.", "green")

# mapping tech_stack keys to official documentation domains
TECH_STACK_DOCS = {
    "react_flask": [
        "react.dev", 
        "flask.palletsprojects.com", 
        "docs.python.org",
        "developer.mozilla.org" #for JS/CSS references
    ],
    "python_script": [
        "docs.python.org",
        "pypi.org", # Good for finding package specific docs
    ],
    "react_only": [
        "react.dev",
        "developer.mozilla.org",
    ],
    "node_backend": [
        "nodejs.org",
        "expressjs.com",
        "developer.mozilla.org"
    ],
    "unknown": [] # Fallback to open web search
}

# agents + helper
def route_query(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Router...", "cyan", attrs=["bold"])
    
    users_prompt = state["user_prompt"]
    cprint(f" Routing query: {users_prompt[:100]}...", "yellow")
    response = llm.with_structured_output(QueryRoute).invoke(router_prompt(users_prompt))
    
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
        session_id = state["session_id"]
        # each user(session for now) gets their own folder
        user_dir = os.path.join(OUTPUT_DIR, session_id, "plan") 
        os.makedirs(user_dir,exist_ok=True)
        file_path = os.path.join(user_dir, "plan_output.json")
        with open(file_path, "w") as f:
            json.dump(response.model_dump(), f, indent=4)
        cprint(f" Plan saved to {file_path}", "green")
        cprint(f" Selected Tech Stack: {response.tech_stack}", "cyan")
    except Exception as e:
        cprint(f"Error saving plan output: {e}", "red")
        
    return {"plan": response}

def normalize_deps(deps: list[str]) -> set[str]:
    # to convert all dependencies into lower case and to remove any extra space before or after them
    return {d.lower().strip() for d in deps}

def architect_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Architect Workflow...", "cyan", attrs=["bold"])
    
    plan: Plan = state["plan"]
    
    cprint(" [1/2] Generating Task Plan & Dependencies...", "yellow")
    task_response = llm.with_structured_output(TaskPlan).invoke(architect_prompt(plan))
    
    if task_response is None:
        raise ValueError("Architect (Builder) failed.")
    
    queue_steps = [step.model_dump() for step in task_response.implementation_steps]
    # queue steps is a list of dictionaries
    dependencies = task_response.dependencies
    
    cprint(f" Architect generated {len(queue_steps)} file tasks.", "green")
    cprint(f" Dependencies identified: {dependencies}", "green")

    # qa architect (input to this is above llms response)
    cprint(" [2/2] Generating QA Strategy...", "yellow")
    # converting the queuesteps in strings
    files_context = "\n".join([f"- {f['file_name']}: {f['task_description']}" for f in queue_steps])
    qa_response = llm.with_structured_output(QAPlan).invoke(qa_architect_prompt(plan, files_context))
    
    if qa_response is None:
        cprint(" QA Architect failed, proceeding with empty tests.", "red")
        qa_tasks = []
    else:
        # make a list of dictinaries for qa_tasks(for qa agent) too as we did with queue_steps(for coder agent)
        qa_tasks = [task.model_dump() for task in qa_response.qa_tasks]
        cprint(f" QA Architect generated {len(qa_tasks)} test files.", "green")

    try:
        session_id = state["session_id"]
        user_dir = os.path.join(OUTPUT_DIR, session_id, "plan") 
        os.makedirs(user_dir, exist_ok=True)
        
        with open(os.path.join(user_dir, "architect_build.json"), "w") as f:
            json.dump(task_response.model_dump(), f, indent=4)
            
        with open(os.path.join(user_dir, "architect_qa.json"), "w") as f:
            json.dump(qa_response.model_dump() if qa_response else {}, f, indent=4)
            
        cprint(f" Plans saved to {user_dir}", "green")
    except Exception as e:
        cprint(f"Error saving architect output: {e}", "red")

    return {
        "task_queue": queue_steps,    # for coder
        "dependencies": normalize_deps(task_response.dependencies),
        "qa_plan": qa_tasks,          # for qa agent
        "current_task_index": 0,
        "completed_files": [],
        "error_report": ""
    }   

# below 2 functions are coder helpers: research and embed async 
def perform_jit_research(topic: str, use_tavily: bool,approved_domains: list = None) -> str:
    """Performs Just-In-Time research using the selected method."""
    if not topic:
        return "No specific topic provided."

    if use_tavily:
        cprint(f"   [Tavily] Researching: {topic}...", "blue")
        # if approved_domains:
            # cprint(f"   [Filter] Restricting to: {approved_domains}", "cyan")
        try:
            results = tavily_client.search(topic, max_results=4)            
            # results = tavily_client.search(topic, max_results=4,include_domains=approved_domains)
            context = []
            for res in results.get("results", []):
                context.append(f"Source: {res['url']}\nContent: {res['content']}")
            return "\n\n".join(context)
        except Exception as e:
            cprint(f"   [Tavily] Failed: {e}. Falling back to VectorDB.", "red")

    #default/fallback is vectordb incase we use up all tavily credits(been there done that)
    cprint(f"   [VectorDB] Retrieving docs for: {topic}...", "yellow")
    try:
        results = retriever.invoke(topic)
        return "\n".join([d.page_content for d in results])
    except Exception as e:
        cprint(f"   [VectorDB] Failed: {e}", "red")
        return "No documentation found."

def embed_file_async(session_id: str, filename: str, code_content: str):
    try:
        memory = CodeMemory(DB_PATH, HF_EMBEDDING_MODEL)
        memory.update_file(session_id, filename, code_content)
        cprint(f"   Indexed {filename} (async)", "green")
    except Exception as e:
        # try catch so as to never crash the graph from a background thread
        cprint(f"   Async embedding failed for {filename}: {e}", "red")

def coder_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    
    queue = state.get("task_queue", [])
    index = state.get("current_task_index", 0)
    
    if index >= len(queue):
        cprint(" All tasks in queue completed.", "green")
        return {"current_task_index": index} 

    current_step = queue[index]
    filename = current_step['file_name']
    task_desc = current_step['task_description']
    topic = current_step['related_docs_topic']
    
    session_id = state["session_id"]
    user_code_dir = os.path.join(OUTPUT_DIR, session_id, "code") 
    file_path = os.path.join(user_code_dir, filename)

    plan = state.get("plan")
    tech_stack = plan.tech_stack if plan else "unknown"
    official_domains = TECH_STACK_DOCS.get(tech_stack, [])

    cprint(f" Processing File ({index+1}/{len(queue)}): {filename}", "cyan", attrs=["bold"])

    #retrieve from vector db or tavily
    search_method = state.get("search_method", False)
    doc_context = perform_jit_research(topic, search_method,approved_domains=official_domains)

    # detect: is this a fix mode or build mode?
    error_report = state.get("error_report")
    
    file_exists = os.path.exists(file_path)

    # below block is for react_flask apps with files nested in frontend and backend folders
    if not file_exists:
        # Vitest/Pytest logs often omit 'frontend/' or 'backend/'. 
        # If the direct path fails, hunt for the file in the subdirectories.
        for root, _, local_files in os.walk(user_code_dir):
            for f in local_files:
                full_path = os.path.join(root, f)
                # If the actual file path ends with the requested filename (e.g. matching 'src/App.test.jsx')
                if full_path.replace("\\", "/").endswith(filename.replace("\\", "/")):
                    file_path = full_path
                    file_exists = True
                    # Update the filename so it saves to the correct absolute location!
                    filename = os.path.relpath(full_path, user_code_dir).replace("\\", "/")
                    break
            if file_exists:
                break

    existing_code = ""

    if file_exists:
        with open(file_path, "r", encoding="utf-8") as f:
            existing_code = f.read()

    # if there's something in error report and that file happens to already exist too then we needa go in build mode
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
        error_report=error_report,
        tech_stack=tech_stack
    )

    try:
        response = llm.invoke(prompt)
        code_content = response.content.strip()
        
        # markdown cleanup for idk what
        if code_content.startswith("```"):
            code_content = re.sub(r"^```[a-zA-Z]*\n", "", code_content)
            code_content = re.sub(r"\n```$", "", code_content)

        # finally write the file to disk
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code_content)

        # to make sure that code is embedded even when hf gives 504 gateway error. 
        # embedding_executor our object from class ThreadPoolExecutor uses a function which takes our function(embed_file_async) as a parameter
        embedding_executor.submit(
            embed_file_async,
            session_id,
            filename,
            code_content
        )

    except Exception as e:
        cprint(f"   Generation failed: {e}", "red")
        raise e

    return {
        "current_task_index": index + 1,   #this is so that the coder knows whether it needs to loop back or move on (i could just add a for loop instead and remove this state variable entirely but im done with this shit)
        "completed_files": [filename],
        # "error_report": "" 
    }

def qa_agent(state: GraphState) -> dict:
    # note: this agent should only run once. 
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering QA Agent (Test Generation)...", "cyan", attrs=["bold"])
    
    qa_plan = state.get("qa_plan", [])
    session_id = state["session_id"]
    plan = state.get("plan")
    tech_stack = plan.tech_stack if plan else "unknown"
    user_code_dir = os.path.join(OUTPUT_DIR, session_id, "code")
    
    if not qa_plan:
        cprint(" No QA tasks defined. Skipping test generation.", "yellow")
        return {}

    cprint(f" Generating {len(qa_plan)} test suites...", "green")

    for i, task in enumerate(qa_plan):
        test_filename = task['test_file_name']
        target_filename = task['target_file']
        scenarios = task['test_scenarios']
        
        cprint(f"   [{i+1}/{len(qa_plan)}] Creating {test_filename} for {target_filename}...", "blue")
        
        # read the freshly generated source code
        source_path = os.path.join(user_code_dir, target_filename)
        if os.path.exists(source_path):
            with open(source_path, "r") as f:
                source_code = f.read()
        else:
            cprint(f"   Source file {target_filename} not found! Skipping...", "red")
            continue
            
        qa_prompt = construct_qa_prompt(target_filename, source_code, scenarios, tech_stack)

        try:
            response = llm.invoke(qa_prompt)
            test_code = response.content.strip()
            
            # Cleanup Markdown
            if test_code.startswith("```"):
                test_code = re.sub(r"^```[a-zA-Z]*\n", "", test_code)
                test_code = re.sub(r"\n```$", "", test_code)
            
            test_path = os.path.join(user_code_dir, test_filename)
            os.makedirs(os.path.dirname(test_path), exist_ok=True)
            with open(test_path, "w") as f:
                f.write(test_code)
            
            cprint(f"   Saved {test_filename}", "green")
            
        except Exception as e:
            cprint(f"   Failed to generate test for {target_filename}: {e}", "red")

    return {"status": "qa_complete"} # state doesn't need to change much, files are on disk

def dependency_validator_agent(state: GraphState) -> dict:

    # check requirements.txt and package.json to see if the packages actually exist or not
    # cus if they dont then no point in making executor install them and then crashing 
    # if they exist then cool go to executer and install deps. if they dont, skip exec and go to eval straight to debug and fix req.txt or package.json
    # basically sends api requests to pypi or npmjs

    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Dependency Validator (API Sanity Check)...", "cyan", attrs=["bold"])
    
    session_id = state["session_id"]
    user_code_dir = os.path.join(OUTPUT_DIR, session_id, "code")
    
    files = state.get("completed_files", [])
    failed_packages = []

    # Find all package files no matter what folder they are in
    req_paths = []
    pkg_paths = []
    for root, _, local_files in os.walk(user_code_dir):
        if "requirements.txt" in local_files:
            req_paths.append(os.path.join(root, "requirements.txt"))
        if "package.json" in local_files:
            pkg_paths.append(os.path.join(root, "package.json"))

    # check python requirements.txt
    for req_path in req_paths:
        cprint(f"   Validating {req_path} against PyPI...", "yellow")
        with open(req_path, "r") as f:
            lines = f.readlines()
            
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"): continue
            
            match = re.match(r'^([a-zA-Z0-9_\-]+)', line)
            if match:
                pkg_name = match.group(1)
                try:
                    res = requests.get(f"https://pypi.org/pypi/{pkg_name}/json", timeout=10)
                    if res.status_code != 200:
                        cprint(f"   [!] HALLUCINATION DETECTED: {pkg_name} does not exist on PyPI.", "red")
                        failed_packages.append(pkg_name)
                except requests.exceptions.RequestException as e:
                    cprint(f"   [!] Network timeout validating {pkg_name}. Skipping check.", "yellow")

    # node package.json check
    for pkg_json_path in pkg_paths:
        cprint(f"   Validating {pkg_json_path} against npm registry...", "yellow")
        with open(pkg_json_path, "r") as f:
            try:
                pkg_data = json.load(f)
                deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
                
                for pkg_name in deps.keys():
                    try:
                        res = requests.get(f"https://registry.npmjs.org/{pkg_name}", timeout=10)
                        if res.status_code != 200:
                            cprint(f"   [!] HALLUCINATION DETECTED: {pkg_name} does not exist on npm.", "red")
                            failed_packages.append(pkg_name)
                    except requests.exceptions.RequestException as e:
                        cprint(f"   [!] Network timeout validating {pkg_name}. Skipping check.", "yellow")
            except json.JSONDecodeError:
                failed_packages.append(f"{pkg_json_path} (Invalid JSON Syntax)")

    # routing logic
    if failed_packages:
        error_msg = f"Dependency Validation Failed. The following packages DO NOT EXIST in the official registries: {', '.join(failed_packages)}. You hallucinated the package name. Find the correct, real package name."
        
        # spoof a failed execution result so the Evaluator immediately flags it as an INFRA error.
        execution = ExecutionResult(
            tests_ran=False,
            tests_passed=False,
            exit_code=1,
            logs=error_msg,
            environment_ok=False 
        )
        return {"execution_result": execution}
    
    cprint("   All dependencies exist. Proceeding to execution.", "green")
    return {"execution_result": None}  #IMPORTANT. DO NOT CHANGE THIS OR INFINITE LOOP GO BRRRRRR


def runtime_selector(state: GraphState) -> dict:
    # select e2b templates. (e2b templates were created in setup_e2b_templates.py file. do not touch it(its one time config anyways))
    deps = state.get("dependencies", {})
    files = state.get("completed_files", [])

    has_py = any(f.endswith(".py") for f in files)
    # has_node = any(f == "package.json" for f in files)
    has_node = any("package.json" in f for f in files)

    if has_py and has_node:
        template = "node-python-base"
    elif has_node:
        template = "node-base"
    else:
        template = "python-base"

    return {"runtime_template": template}

def executor_agent(state: GraphState) -> dict:
    cprint(" Entering Executor...", "cyan", attrs=["bold"])

    session_id = state.get("session_id")
    # Extract the string value of template from the dictionary
    template_string = runtime_selector(state).get("runtime_template")
    saved_sandbox_id = state.get("sandbox_id") or get_sandbox_for_session(session_id)

    sandbox = None

    # if for this session, a sandbox exists, then just connect to it
    if saved_sandbox_id:
        try:
            sandbox = Sandbox.connect(saved_sandbox_id)
            cprint(f"   Reconnected to Sandbox: {saved_sandbox_id}", "green")
        except Exception as e:
            cprint(f"   Could not connect (might have timed out). Creating new one. Error: {e}", "red")            
            sandbox = None

    # else create a new sandbox 
    if not sandbox:
        cprint("   Spinning up NEW Cloud Sandbox...", "blue")
        sandbox = Sandbox.create(template=template_string)
        register_sandbox(session_id, sandbox.sandbox_id)
        cprint(f"   New Sandbox Created and Registered. ID: {sandbox.sandbox_id}", "green")

    # sync files. do this everytime cus during debug loop the coder might change files so e2b vm gotta have the updated versions in it
    code_dir = os.path.join(OUTPUT_DIR, session_id, "code")
    for root, _, files in os.walk(code_dir):
        for file in files:
            local = os.path.join(root, file)
            remote = f"/home/user/app/{os.path.relpath(local, code_dir)}"
            sandbox.files.write(remote, open(local, "rb"))

    # install deps
    # do not change the sandbox commands please. they are precarious and were crafted carefully after 100 app crashes
    try:
        # if "python" in template_string:
        #     cprint("   Installing Python dependencies and pytest...", "yellow")
        #     # sandbox.commands.run(
        #     #     "cd /home/user/app && pip install pytest && if [ -f requirements.txt ]; then pip install -r requirements.txt; fi", 
        #     #     timeout=120
        #     # ) 
        #     sandbox.commands.run(
        #         "cd /home/user/app && pip install pytest --break-system-packages && if [ -f requirements.txt ]; then pip install -r requirements.txt --break-system-packages; fi", 
        #         timeout=120
        #     )       
        #     cprint("   Finished Install", "cyan")
        if "python" in template_string:
            cprint("   Installing Python dependencies and pytest...", "yellow")
            # Install pytest globally first
            sandbox.commands.run(
                "pip install pytest --break-system-packages", 
                timeout=60
            )
            # Find any requirements.txt anywhere in the app and install it from within its own directory
            sandbox.commands.run(
                "cd /home/user/app && find . -name 'requirements.txt' -execdir pip install -r {} --break-system-packages \\;", 
                timeout=120
            )       
            cprint("   Finished Install", "cyan")
            
        if "node" in template_string:
            cprint("   Installing Node dependencies...", "yellow")
            # execdir and legacy peer flags are imp!!!
            sandbox.commands.run(
                "cd /home/user/app && find . -name 'package.json' -not -path '*/node_modules/*' -execdir npm install --legacy-peer-deps \\;", 
                timeout=120
            )
            cprint("   Finished Install", "cyan")

    except Exception as e:
        # if pip or npm explodes,i.e, installing of dependencies wasnt successful, catch it and send it eval and debugger so that coder can fix req.txt and package.json
        cprint(f"   Dependency Install Failed: {e}", "red")
        
        execution = ExecutionResult(
            tests_ran=False,
            tests_passed=False,
            exit_code=1,
            logs=f"Failed to install dependencies. Check your requirements.txt or package.json for invalid packages. Error: {str(e)}",
            environment_ok=False  # flag that the environment is broken!
        )
        # leave the executor, no point in going to the next bit
        return {
            "execution_result": execution,
            "sandbox_id": sandbox.sandbox_id,
            "iteration_count": state.get("iteration_count", 0) + 1
        }

    # assuming deps were installed successfully
    cprint("   Running tests...", "magenta")
    
    try:
        combined_logs = ""
        # again do not change the test commands
        if template_string == "python-base":
            cprint("   Running Python tests...", "yellow")
            result = sandbox.commands.run("cd /home/user/app && python -m pytest -q", timeout=30)
            combined_logs = result.stdout + result.stderr
            
        elif template_string == "node-base":
            cprint("   Running Node tests...", "yellow")
            result = sandbox.commands.run("cd /home/user/app && find . -name 'package.json' -not -path '*/node_modules/*' -execdir npm test \\;", timeout=60)
            combined_logs = result.stdout + result.stderr
            
        elif template_string == "node-python-base":
            cprint("   Running Frontend Tests...", "blue")
            res_node = sandbox.commands.run("cd /home/user/app && find . -name 'package.json' -not -path '*/node_modules/*' -execdir npm test \\;", timeout=60)
            combined_logs += "=== FRONTEND LOGS ===\n" + res_node.stdout + res_node.stderr
            
            cprint("   Running Backend Tests...", "blue")
            res_py = sandbox.commands.run("cd /home/user/app && PYTHONPATH=. python3 -m pytest -q", timeout=60)
            combined_logs += "\n=== BACKEND LOGS ===\n" + res_py.stdout + res_py.stderr
            
        execution = ExecutionResult(
            tests_ran=True,
            tests_passed=True,
            exit_code=0,
            logs=combined_logs,
            environment_ok=True
        )
        
    except Exception as e:
        # E2B throws an exception immediately if a test fails (Exit Code > 0).
        # In the hybrid setup, if the Frontend fails, it will catch here and skip the Backend tests. 
        # This is a good "fail-fast" mechanism so the Debugger can fix one thing at a time!
        error_logs = getattr(e, 'stdout', '') + getattr(e, 'stderr', str(e))
        exit_code = getattr(e, 'exit_code', 2)
        
        cprint(f"   Tests Failed or Crashed (Exit Code {exit_code})", "red")
        
        # If it's hybrid, append whatever logs we managed to collect before the crash
        final_logs = (combined_logs + "\n=== CRASH LOGS ===\n" + error_logs) if template_string == "node-python-base" else error_logs
        
        execution = ExecutionResult(
            tests_ran=True,
            tests_passed=False,
            exit_code=exit_code,
            logs=final_logs,
            environment_ok=True 
        )

    return {
        "execution_result": execution,
        "sandbox_id": sandbox.sandbox_id,
        "iteration_count": state.get("iteration_count", 0) + 1
    }

def evaluator_agent(state: dict) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Evaluator (LLM Analysis)...", "cyan", attrs=["bold"])
    
    # extract the execution payload from the state,i.e, executors output
    execution = state.get("execution_result")
    if not execution:
        cprint("   No execution result found in state. Defaulting to Fail.", "red")
        return {"status": "fail", "error_report": "Missing execution payload.", "error_category": "infra"}

    logs = execution.logs
    exit_code = execution.exit_code
    env_ok = execution.environment_ok

    # Fast-track success
    if execution.tests_passed and env_ok:
        cprint(f" Evaluation: PASS", "green", attrs=["bold"])
        return {
            "status": "pass", 
            "error_report": "All tests passed successfully.",
            "error_category": ErrorCategory.NONE.value,
            "attempt_history": state.get("attempt_history", [])
        }

    eval_prompt = construct_evaluator_prompt(env_ok, exit_code, logs)
    # basically eval just takes executors state, and classifies the error into one of the 5 categories and
    # summarizes the logs
    # if eval fails then we just pass raw logs to the debugger and hardcode the category as runtime 
    try:
        response = llm.with_structured_output(EvaluationResult).invoke(eval_prompt)
        status = response.status
        feedback = response.feedback
        category = response.category.value
        
    except Exception as e:
        cprint(f"   Evaluator LLM failed: {e}. Defaulting to Runtime Fail.", "red")
        status = "fail"
        feedback = f"Evaluator crashed. Raw logs: {logs[-500:]}"
        category = "runtime"

    cprint(f" Evaluation: FAIL [{category.upper()}]", "red", attrs=["bold"])
    cprint(f" Reason: {feedback}", "red")
        
    return {
        "status": status, 
        "error_report": feedback,
        "error_category": category,
        "attempt_history": state.get("attempt_history", [])
    }

# do not change this function, it works exceptionally well
def search_codebase_filesystem(session_id: str, error_report: str, max_files: int = 5) -> str:
    # takes error string and pattern matches it with code(every line of every file in every folder)
    # and returns the a list of filenames and its content
    # if exact file not found then return the last modified files
    
    code_dir = os.path.join(OUTPUT_DIR, session_id, "code")
    if not os.path.exists(code_dir):
        return "No code files found."

    safe_error = error_report.lower() if error_report else ""
    matches = []
    
    # 1. Gather all files and their last modified times
    file_list = []
    for root, _, files in os.walk(code_dir):
        for file in files:
            # Ignore weird phantom files
            if file in ["None", "unknown", "None.py"]:
                continue
                
            path = os.path.join(root, file)
            try:
                mtime = os.path.getmtime(path)
                file_list.append((file, path, mtime))
            except Exception:
                continue
                
    # 2. Sort files by newest first (descending order)
    file_list.sort(key=lambda x: x[2], reverse=True)

    all_files_content = []

    # 3. Process the sorted files
    for file, path, _ in file_list:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                
                # Direct match check
                if safe_error and file.lower() in safe_error:
                    matches.append(f"FILE: {file}\n```python\n{content}\n```")
                
                # Store in fallback (now ordered by newest!)
                all_files_content.append(f"FILE: {file}\n```python\n{content[:2000]}\n```")
        except Exception as e:
            cprint(f"   [Search] Could not read {file}: {e}", "red")
            continue

    if matches:
        cprint(f"   [Search] Found exact file matches for the error.", "green")
        return "\n\n".join(matches[:max_files])
    
    if all_files_content:
        cprint(f"   [Search] No exact file match, falling back to recent codebase context.", "yellow")
        return "\n\n".join(all_files_content[:max_files])

    return "No relevant code found via filesystem."

def debugger_agent(state: dict) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Debugger...", "cyan", attrs=["bold"])
    
    session_id = state.get("session_id")
    current_error = state.get("error_report")
    error_category = state.get("error_category", "runtime")
    iteration = state.get("iteration_count", 1)
    past_attempts = state.get("attempt_history", [])
    plan = state.get("plan")
    
    #past history + attempts
    formatted_history = ""
    if past_attempts:
        formatted_history = "PREVIOUS FAILED ATTEMPTS (DO NOT REPEAT THESE):\n"
        for i, attempt in enumerate(past_attempts):
            formatted_history += f"Attempt {i+1}: Tried to fix error '{attempt['error'][:50]}...' with plan: {attempt['plan_summary']}\n"

    #code context(do not change this!!!)
    cprint("   Gathering codebase context...", "yellow")
    relevant_context = search_codebase_filesystem(session_id, current_error)
    cprint(f"   Retrieved code context: {relevant_context[:75]}", "yellow")

    # dynamic instructions based on category(classified by eval)
    category_instructions = ""
    if error_category == "infra":
        category_instructions = "This is an INFRA structure error. You MUST target `requirements.txt` or `package.json`. Remove invalid, built-in, or hallucinated packages. DO NOT modify application logic."
    elif error_category == "timeout":
        category_instructions = "This is a TIMEOUT error. Look for 'while True' loops, missing 'break' statements, or UI windows opening without 'if __name__ == \"__main__\":' protections."
    elif error_category == "logical":
        category_instructions = "This is a LOGICAL error. The code runs, but the math/logic is wrong. Focus on the core algorithmic logic failing the tests."
    elif error_category == "syntax":
        category_instructions = "This is a SYNTAX error. Look for missing colons, bad indentation, malformed f-strings, or missing module imports (ModuleNotFoundError). Fix the exact lines causing the crash."
    elif error_category == "runtime":
        category_instructions = "This is a RUNTIME error. The code compiled but crashed during execution (e.g., TypeError, AttributeError, KeyError). Trace the variables and object types to prevent the crash."

    prompt = construct_debugger_prompt(
        error_category=error_category,
        category_instructions=category_instructions,
        current_error=current_error,
        formatted_history=formatted_history,
        relevant_context=relevant_context,
    )
    
    fix_plan = llm.with_structured_output(DebugPlan).invoke(prompt)

    try:
        user_debug_dir = os.path.join(OUTPUT_DIR, session_id, "debug")
        os.makedirs(user_debug_dir, exist_ok=True)
        
        file_path = os.path.join(user_debug_dir, f"fix_plan_iter_{iteration}.json")
        with open(file_path, "w") as f:
            json.dump(fix_plan.model_dump(), f, indent=4)
        cprint(f"   Fix plan saved to {file_path}", "green")
        
    except Exception as e:
        cprint(f"   Error saving debug output: {e}", "red")
    
    # update history
    new_attempt = {
        "error": current_error,
        "plan_summary": str([step.task_description for step in fix_plan.implementation_steps])
    }

    return {
        "task_queue": [step.model_dump() for step in fix_plan.implementation_steps],
        "current_task_index": 0, #coder set it to the number of tasks/files it wrote while looping. debugger sets it to 0 so that coder knows it has to start writing files again from task queue
        "error_report": current_error,
        "error_category": error_category,
        "attempt_history": [new_attempt]
    }

def learner_agent(state: GraphState) -> dict:
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Entering Learner Agent (Placeholder)...", "cyan", attrs=["bold"])
    return {} 

#graph definition
graph = StateGraph(GraphState)

# all nodes 
graph.add_node("router", route_query)
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder", coder_agent) 
graph.add_node("qa_agent", qa_agent)
graph.add_node("dependency_validator",dependency_validator_agent)
graph.add_node("executor", executor_agent)
graph.add_node("evaluator", evaluator_agent)
graph.add_node("debugger", debugger_agent)
graph.add_node("learner", learner_agent)


# entry point is router
graph.set_entry_point("router")

#conditional edge functionals called by conditional edges
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

def check_queue_status(state: GraphState) -> Literal["coder", "qa_agent", "dependency_validator"]:
    queue = state.get("task_queue", [])
    index = state.get("current_task_index", 0)
    iteration = state.get("iteration_count", 0)
    
    if index < len(queue):
        return "coder"  
    else: #done to ensure the qa agent runs only once
        # If iteration is 0, we haven't executed yet. Go to QA to write tests.
        if iteration == 0:
            cprint("   [Router] Initial build complete. Moving to QA Agent...", "yellow")
            return "qa_agent"
        # If iteration > 0, we are in a repair loop. Skip QA, go straight to Validator.
        else:
            cprint("   [Router] Debug patch complete. Bypassing QA -> Validator...", "yellow")
            return "dependency_validator"

def check_validation_status(state: GraphState) -> Literal["executor", "evaluator"]:
    execution = state.get("execution_result")
    
    # If the validator created a failed execution result, skip the E2B executor entirely
    if execution and execution.environment_ok == False:
        cprint("   [Router] Validation failed. Bypassing Executor -> Evaluator", "yellow")
        return "evaluator"
    
    # Otherwise, packages are real, go to the sandbox
    return "executor"

def check_evaluation(state: GraphState) -> Literal["debugger", END]:
    status = state.get("status")
    count = state.get("iteration_count", 0)
    
    if status == "fail" and count < 3: # Limit retries to 3
        return "debugger"
    return END


#edges and conditional edges
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
        "coder": "coder",       # loop back
        "qa_agent": "qa_agent", # move on
        "dependency_validator": "dependency_validator"
    }
)
graph.add_edge("qa_agent", "dependency_validator")

graph.add_conditional_edges(
    "dependency_validator",
    check_validation_status,
    {
        "executor": "executor",
        "evaluator": "evaluator"
    }
)
graph.add_edge("executor", "evaluator")

graph.add_conditional_edges(
    "evaluator", 
    check_evaluation,
    {
        "debugger": "debugger", 
        END: END
    }
)

graph.add_edge("debugger", "coder") # close the loop!!!!!    
graph.add_edge("learner", END)

agent = graph.compile()

if __name__ == "__main__":
        
    cprint("\nWelcome to Lock-In", "yellow", attrs=["bold"])
    user_prompt = input("Please enter your project request: ")

    search_method_input = input("Choose search method: 0 for 'default' (vector DB) or 1 for 'advance' (Live Search): ").strip()
    search_method = (search_method_input == "1")  # True for advance, False for default

    session_id = str(uuid.uuid4())
    cprint(f" Session ID generated: {session_id}", "cyan")


    #try not to comment any of the ones below or else the app /will/ crash
    initial_state: GraphState = {
        "session_id":session_id,
        "user_prompt": user_prompt,
        "route": None,
        "plan": None, 
        "task_queue":[],
        "dependencies": [],    
        "qa_plan": [],
        "completed_files": [],
        "current_task_index": 0, 
        "search_method": search_method,
        "iteration_count": 0, #count for exec-eval-debug loop
        "error_report": "",
        "status" : "fail",
        "sandbox_id": get_sandbox_for_session(session_id),
        "attempt_history":[]
    }
    result = agent.invoke(initial_state,config={"recursion_limit": 100})

    cprint(f"\n{'='*50}", "magenta")
    cprint("\n Agent workflow finished. Final state:", "green", attrs=["bold"])
    import pprint
    pprint.pprint(result)