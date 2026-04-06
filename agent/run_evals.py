import os
import json
import uuid
import time
from termcolor import cprint
from e2b_code_interpreter import Sandbox

# Import graph, constants, and YOUR PYDANTIC MODEL
from graph import agent, OUTPUT_DIR
from sandbox_registry import get_sandbox_for_session, register_sandbox
from states import Plan  # <--- CRITICAL: Import your Plan model!

def setup_test_workspace(session_id: str, files_dict: dict):
    """Writes the initial_workspace files to disk to simulate an existing project."""
    user_code_dir = os.path.join(OUTPUT_DIR, session_id, "code")
    os.makedirs(user_code_dir, exist_ok=True)
    
    written_files = []
    for filepath, content in files_dict.items():
        full_path = os.path.join(user_code_dir, filepath)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written_files.append(filepath)
    return written_files

def run_hidden_eval(session_id: str, tech_stack: str, hidden_test: str) -> bool:
    """Spins up a temporary sandbox, uploads the modified code + hidden test, and runs it."""
    cprint("\n[EVAL] Running Hidden Evaluation Test...", "magenta", attrs=["bold"])
    
    template = "node-base" if "react" in tech_stack else "python-base"
    user_code_dir = os.path.join(OUTPUT_DIR, session_id, "code")
    
    sandbox = None # Initialize so the finally block doesn't crash if creation fails
    try:
        sandbox = Sandbox.create(template=template)
        
        # 1. Upload the Agent's modified code
        for root, _, files in os.walk(user_code_dir):
            for file in files:
                local_path = os.path.join(root, file)
                remote_path = f"/home/user/app/{os.path.relpath(local_path, user_code_dir)}"
                with open(local_path, "rb") as f:
                    sandbox.files.write(remote_path, f)

        # 2. Write the hidden test file to the sandbox
        test_filename = "eval.test.jsx" if "react" in tech_stack else "test_eval.py"
        sandbox.files.write(f"/home/user/app/{test_filename}", hidden_test)

        # 3. Install deps and run the specific test
        if template == "python-base":
            sandbox.commands.run("cd /home/user/app && pip install pytest", timeout=60)
            res = sandbox.commands.run(f"cd /home/user/app && pytest {test_filename} -q", timeout=30)
            passed = "1 passed" in res.stdout.lower() or "passed" in res.stdout.lower()
        else:
            sandbox.commands.run("cd /home/user/app && npm install", timeout=120)
            res = sandbox.commands.run(f"cd /home/user/app && npx vitest run {test_filename}", timeout=60)
            passed = "pass" in res.stdout.lower() and "fail" not in res.stdout.lower()
            
        return passed
    
    except Exception as e:
        cprint(f"[EVAL ERROR] Sandbox failed during evaluation: {e}", "red")
        return False
    finally:
        # <--- CRITICAL FIX: Always kill the sandbox, even if an exception occurs
        if sandbox:
            sandbox.kill()
            cprint("   Sandbox successfully killed.", "dark_grey")

def main():
    with open("eval_cases.json", "r") as f:
        tests = json.load(f)

    results = []

    for idx, test in enumerate(tests):
        cprint(f"\n{'='*60}", "blue", attrs=["bold"])
        cprint(f" RUNNING TEST {idx+1}/{len(tests)}: {test['test_id']}", "white", "on_blue", attrs=["bold"])
        cprint(f" Desc: {test['description']}", "cyan")
        
        session_id = f"eval_{test['test_id']}_{str(uuid.uuid4())[:8]}"
        
        # 1. Seed the environment
        written_files = setup_test_workspace(session_id, test["initial_workspace"])
        
        # 2. Prime the LangGraph state
        initial_state = {
            "session_id": session_id,
            "user_prompt": test["user_prompt"],
            "completed_files": written_files, 
            # <--- CRITICAL FIX: Instantiate the Pydantic model!
            # Note: Add any other required fields for your Plan model if tech_stack isn't enough
            "plan": Plan(tech_stack=test["tech_stack"], project_goal=test["description"]), 
            "task_queue": [],
            "iteration_count": 0,
            "sandbox_id": None,
            "attempt_history": [],
            "search_method": False # <--- MINOR FIX: explicitly defining this
        }
        
        config = {"configurable": {"thread_id": session_id}}
        
        # 3. Run the Agent
        try:
            for event in agent.stream(initial_state, config=config, stream_mode="values"):
                pass 
        except Exception as e:
            cprint(f"Agent crashed during evaluation: {e}", "red")
            results.append({"id": test["test_id"], "status": "AGENT_CRASH"})
            continue

        # 4. Evaluate the result
        hidden_test_code = test["evaluation_criteria"]["hidden_test"]
        eval_passed = run_hidden_eval(session_id, test["tech_stack"], hidden_test_code)

        if eval_passed:
            cprint(f"✅ {test['test_id']} PASSED", "green", attrs=["bold"])
            results.append({"id": test["test_id"], "status": "PASS"})
        else:
            cprint(f"❌ {test['test_id']} FAILED", "red", attrs=["bold"])
            results.append({"id": test["test_id"], "status": "FAIL"})

    # Print Summary
    cprint("\n\n=== EVALUATION SUMMARY ===", "magenta", attrs=["bold"])
    passed = sum(1 for r in results if r["status"] == "PASS")
    cprint(f"Total Score: {passed}/{len(tests)}", "cyan", attrs=["bold"])
    for r in results:
        color = "green" if r["status"] == "PASS" else "red"
        cprint(f" - {r['id']}: {r['status']}", color)

if __name__ == "__main__":
    main()