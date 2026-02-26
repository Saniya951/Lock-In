# import os
# import json
# from dotenv import load_dotenv
# from graph import executor_agent, OUTPUT_DIR 
# from sandbox_registry import get_sandbox_for_session, register_sandbox

# load_dotenv()

# # TEST_SESSION_ID = "981b245b-6b0a-4214-8f12-77fdbb8dd369"

# TEST_SESSION_ID ="6696b3b8-b344-43b8-be3d-c24af593dc20"
# def run_test():
#     print(f"\n🚀 STARTING EXECUTOR TEST [Session: {TEST_SESSION_ID}]")

#     # 1. Load existing ID (if any)
    
#     existing_id = get_sandbox_for_session(TEST_SESSION_ID)  
#     if existing_id:  
#         print(f"🔄 Found saved Sandbox ID: {existing_id}")
#     else:
#         print(f"🆕 No saved ID found. A new sandbox will be created.")

#     # 2. Mock State with the ID
#     mock_state = {
#         "session_id": TEST_SESSION_ID,
#         "user_prompt": "Test run",
#         "task_queue": [],
#         "iteration_count": 0,
#         "execution_logs": "",
#         "error_report": "",
#         "sandbox_id": existing_id # Pass it in!
#     }

#     # 3. Run Agent
#     try:
#         result = executor_agent(mock_state)
        
#         print("\n" + "="*50)
#         print("✅ TEST PASSED")
#         print("="*50)
        
#         # 4. Save the new ID (in case a new one was created)
#         new_id = result.get("sandbox_id")
#         if new_id and new_id != existing_id:
#             register_sandbox(TEST_SESSION_ID,new_id)

#     except Exception as e:
#         print("\n" + "="*50)
#         print("❌ TEST FAILED")
#         print("="*50)
#         print(e)

# if __name__ == "__main__":
#     run_test()

import os
from dotenv import load_dotenv
from termcolor import cprint

# Import your executor and helper from your main graph file
from graph import executor_agent
from sandbox_registry import get_sandbox_for_session

load_dotenv()

# Your hardcoded test data
TEST_SESSION_ID = "3f51610f-a975-40e5-a069-b31e47805d49"
COMPLETED_FILES = [
    'requirements.txt', 'main.py', 'snake.py', 'food.py', 
    'game.py', 'score.py', 'requirements.txt', 'game.py', 
    'requirements.txt', 'requirements.txt'
]

def run_isolated_executor():
    cprint(f"\n🚀 STARTING ISOLATED EXECUTOR TEST", "white", "on_blue", attrs=["bold"])
    print(f"Session: {TEST_SESSION_ID}")

    # 1. Check for an existing sandbox
    existing_sandbox_id = get_sandbox_for_session(TEST_SESSION_ID)

    # 2. Build the exact state dictionary the executor expects
    mock_state = {
        "session_id": TEST_SESSION_ID,
        "completed_files": COMPLETED_FILES,
        "sandbox_id": existing_sandbox_id,
        "dependencies": {}, # Required if your runtime_selector accesses state.dependencies
        "iteration_count": 0
    }

    # 3. Call the agent directly (No LangGraph workflow needed!)
    cprint("\n⏳ Invoking executor_agent()...", "magenta")
    try:
        # This will trigger the sync, pip install, and pytest commands
        result_state = executor_agent(mock_state)
        
        # 4. Print the output nicely
        cprint("\n✅ EXECUTOR FINISHED SUCCESSFULLY", "green", attrs=["bold"])
        print("="*50)
        
        execution = result_state.get("execution_result")
        if execution:
            print(f"Tests Ran:       {execution.tests_ran}")
            print(f"Tests Passed:    {execution.tests_passed}")
            print(f"Exit Code:       {execution.exit_code}")
            print(f"Environment OK:  {execution.environment_ok}")
            print("\n--- RAW EXECUTION LOGS ---")
            print(execution.logs)
            print("--------------------------")
        
        print(f"\nReturned Sandbox ID: {result_state.get('sandbox_id')}")
        print(f"New Iteration Count: {result_state.get('iteration_count')}")
        print("="*50)

    except Exception as e:
        cprint(f"\n❌ EXECUTOR FAILED: {e}", "red", attrs=["bold"])

if __name__ == "__main__":
    # Make sure OUTPUT_DIR exists in your current working directory 
    # so the executor can find the files to sync!
    run_isolated_executor()