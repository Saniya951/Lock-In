import os
import uuid
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv
from termcolor import cprint

# Import everything needed from your main graph.py
from graph import (
    executor_agent, 
    evaluator_agent, 
    debugger_agent, 
    coder_agent, 
    dependency_validator_agent, # Make sure this is exported/importable
    GraphState, 
    get_sandbox_for_session
)

load_dotenv()

# The Session ID you want to test (Must have existing code in output/)
TEST_SESSION_ID = "cadd70ed-53b2-4b27-ac02-63a617e4870a"

# --- CUSTOM ROUTING FOR TEST LOOP ---
def test_loop_logic(state: GraphState):
    """Routes the Coder either back to itself, or to the Validator."""
    queue = state.get("task_queue", [])
    index = state.get("current_task_index", 0)
    
    if index < len(queue):
        return "coder"      
    else:
        return "dependency_validator"   # Replaced "executor" with the bouncer!

def check_eval_status(state: GraphState):
    """Routes Evaluator to Debugger, with a hard cap to prevent infinite test loops."""
    status = state.get("status")
    iteration = state.get("iteration_count", 0)
    
    # Failsafe: Stop after 5 iterations so you don't burn tokens if it gets stuck
    if status == "fail" and iteration < 5:
        return "debugger"
    return END

def check_test_validation_status(state: GraphState):
    """Routes Validator to Executor (pass) or Evaluator (fail)."""
    execution = state.get("execution_result")
    
    if execution and execution.environment_ok == False:
        cprint("   [Router] Validation failed. Bypassing Executor -> Evaluator", "yellow")
        return "evaluator"
    return "executor"

def run_repair_loop_test():
    cprint(f"\n🚀 STARTING REPAIR LOOP TEST [Session: {TEST_SESSION_ID}]", "white", "on_blue", attrs=["bold"])

    # 1. Build the Mini-Graph
    workflow = StateGraph(GraphState)

    # Add the nodes
    workflow.add_node("executor", executor_agent)
    workflow.add_node("evaluator", evaluator_agent)
    workflow.add_node("debugger", debugger_agent)
    workflow.add_node("coder", coder_agent)
    workflow.add_node("dependency_validator", dependency_validator_agent) 

    # Set Entry Point -> Start at Executor (to evaluate the existing broken code)
    workflow.set_entry_point("executor")

    # Wire the straight edges
    workflow.add_edge("executor", "evaluator")
    
    
    # Evaluator -> Debugger (if fail) OR End (if pass)
    workflow.add_conditional_edges(
        "evaluator",
        check_eval_status,
        {
            "debugger": "debugger",
            END: END
        }
    )
    workflow.add_edge("debugger", "coder")
    # Coder -> Coder (Loop) OR -> Dependency Validator
    workflow.add_conditional_edges(
        "coder",
        test_loop_logic,
        {
            "coder": "coder",
            "dependency_validator": "dependency_validator"
        }
    )

    # Dependency Validator -> Executor (Pass) OR Evaluator (Fail)
    workflow.add_conditional_edges(
        "dependency_validator",
        check_test_validation_status,
        {
            "executor": "executor",
            "evaluator": "evaluator"
        }
    )

    app = workflow.compile()

    # 2. Prepare State
    existing_sandbox_id = get_sandbox_for_session(TEST_SESSION_ID)
    
    initial_state = {
        "session_id": TEST_SESSION_ID,
        "user_prompt": "Debug Run", # Placeholder
        "sandbox_id": existing_sandbox_id,
        "task_queue": [], 
        "current_task_index": 0,
        "execution_logs": "",
        "error_report": "",
        "iteration_count": 0,
        "completed_files": [], # Added this so the validator has files to check
        "search_method":"1"
    }

    # 3. Run the Graph
    print(f"🔄 Connected to Sandbox: {existing_sandbox_id}")
    print("⏳ Starting Loop: Executor -> Evaluator -> Debugger -> Coder -> Validator -> Executor ...")
    
    # recursion_limit increased to handle the coder looping over multiple files + iterations
    result = app.invoke(initial_state, config={"recursion_limit": 50})

    print("\n" + "="*50)
    print(f"🏁 TEST FINISHED. Final Status: {result.get('status')}")
    print(f"🔄 Total Iterations: {result.get('iteration_count')}")
    print("="*50)

if __name__ == "__main__":
    run_repair_loop_test()