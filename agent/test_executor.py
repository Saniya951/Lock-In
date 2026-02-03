import os
from dotenv import load_dotenv
# REPLACE 'main' with the actual name of your python file
from graph import executor_agent, OUTPUT_DIR 

load_dotenv()

# 1. Set a fixed Session ID so we keep testing the same folder
TEST_SESSION_ID = "afa99c45-d214-40bd-9234-ce1a66836f84"
# /home/sim/coding shenanigans/fullstack projects/Lock-In/agent/output/
# 2. Setup the directory path
code_dir = os.path.join(OUTPUT_DIR, TEST_SESSION_ID, "code")

# --- THE TEST HARNESS ---
def run_test():
    print(f"\n🚀 STARTING ISOLATED EXECUTOR TEST [Session: {TEST_SESSION_ID}]")
    
    # 2. Mock the GraphState
    # The executor only really cares about 'session_id' and 'iteration_count'
    mock_state = {
        "session_id": TEST_SESSION_ID,
        "user_prompt": "Test run",
        "task_queue": [],
        "iteration_count": 0,
        "execution_logs": "",
        "error_report": ""
    }

    # 3. Call the function directly
    try:
        result = executor_agent(mock_state)
        
        print("\n" + "="*50)
        print("✅ TEST PASSED")
        print("="*50)
        print("LOGS RETURNED:")
        print(result["execution_logs"])
        
    except Exception as e:
        print("\n" + "="*50)
        print("❌ TEST FAILED")
        print("="*50)
        print(e)

if __name__ == "__main__":
    run_test()