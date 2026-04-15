import os
import csv
from collections import defaultdict
from langsmith import Client
from dotenv import load_dotenv

# 1. Load the environment variables to prevent 401 Unauthorized errors
load_dotenv()

# Initialize the LangSmith client
client = Client()

# --- CONFIGURATION ---
PROJECT_NAME = os.getenv("LANGCHAIN_PROJECT", "default") 
OUTPUT_CSV = "langsmith_eval_metrics-withoutduplicates-withbadreqs-pt2.csv"

def main():
    print(f"Fetching runs for project: {PROJECT_NAME}...")
    
    try:
        all_runs = list(client.list_runs(project_name=PROJECT_NAME))
    except Exception as e:
        print(f"❌ Failed to connect to LangSmith: {e}")
        print("Please ensure LANGCHAIN_API_KEY is correctly set in your .env file.")
        return

    print(f"Downloaded {len(all_runs)} total run components. Grouping into traces...")

    # Group runs by their Trace ID 
    traces = defaultdict(list)
    for run in all_runs:
        traces[run.trace_id].append(run)

    print(f"Found {len(traces)} unique interactions/prompts.")

    results = []

    for trace_id, runs in traces.items():
        # The root run is the entry point
        root_run = next((r for r in runs if r.parent_run_id is None), runs[0])
        
        # Extract the user's prompt
        user_prompt = "Unknown"
        if root_run.inputs:
            user_prompt = root_run.inputs.get("user_prompt", str(root_run.inputs)[:50])

        # Check for 429 Rate Limits
        hit_rate_limit = False
        error_msg = str(root_run.error).lower() if root_run.error else ""
        if "429" in error_msg or "rate limit" in error_msg or "rate_limit" in error_msg:
            hit_rate_limit = True

        hit_bad_request = False
        if "400" in error_msg or "tool_use_failed" in error_msg or "badrequesterror" in error_msg:
            hit_bad_request = True

        node_names = [r.name for r in runs]
        debugger_count = node_names.count("debugger")
        
        # Isolate all Evaluator runs and sort them chronologically
        evaluator_runs = [r for r in runs if r.name == "evaluator"]
        evaluator_runs.sort(key=lambda x: x.start_time if x.start_time else 0)

        is_success = False
        error_categories = []

        if evaluator_runs:
            # 1. Check the FINAL evaluator run for the ultimate pass/fail status
            final_eval = evaluator_runs[-1]
            if final_eval.outputs and isinstance(final_eval.outputs, dict):
                is_success = (final_eval.outputs.get("status") == "pass")

            # 2. Collect ALL error categories encountered during the loop for analytics
            for eval_run in evaluator_runs:
                if eval_run.outputs and isinstance(eval_run.outputs, dict):
                    cat = eval_run.outputs.get("error_category")
                    # Ignore "none" (which happens on a pass) to keep the CSV clean
                    if cat and cat.lower() != "none":
                        error_categories.append(cat)

        # Determine Specific Pathways
        is_zero_shot = is_success and (debugger_count == 0)
        is_recovered = is_success and (debugger_count > 0)

        results.append({
            "Trace ID": trace_id,
            "Timestamp": root_run.start_time.strftime("%Y-%m-%d %H:%M:%S") if root_run.start_time else "N/A",
            "User Prompt": user_prompt,
            "Hit Rate Limit": hit_rate_limit,
            "Hit Bad Request": hit_bad_request,
            "Success (Evaluator Passed)": is_success,
            "Debugger Invocations": debugger_count,
            "Zero-Shot Success": is_zero_shot,
            "Recovered by Debugger": is_recovered,
            "Evaluator Categories Encountered": ", ".join(error_categories) if error_categories else "None"
        })

    # Filter out the rate limits before calculating final metrics
    # valid_runs = [r for r in results if not r["Hit Rate Limit"]]

    # 4. Filter out rate limits AND remove duplicate prompts
    valid_runs = []
    seen_prompts = set()
    
    for r in results:
        if not r["Hit Rate Limit"]:
            # Check if we've already seen this exact prompt
            if r["User Prompt"] not in seen_prompts:
                valid_runs.append(r)
                seen_prompts.add(r["User Prompt"])

    
    # Write to CSV
    headers = ["Trace ID", "Timestamp", "User Prompt", "Hit Rate Limit", "Hit Bad Request", "Success (Evaluator Passed)", 
               "Debugger Invocations", "Zero-Shot Success", "Recovered by Debugger", "Evaluator Categories Encountered"]

    with open(OUTPUT_CSV, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✅ Data exported to {OUTPUT_CSV}")
    print("\n" + "="*50)
    print(" QUICK METRICS (Excluding Rate Limit Crashes)")
    print("="*50)
    
    total_valid = len(valid_runs)
    if total_valid == 0:
        print("No valid runs found after filtering out rate limits.")
        return

    successes = sum(1 for r in valid_runs if r["Success (Evaluator Passed)"])
    zero_shots = sum(1 for r in valid_runs if r["Zero-Shot Success"])
    recovered = sum(1 for r in valid_runs if r["Recovered by Debugger"])

        # Calculate Early Terminations (X%)
    total_failed = total_valid - successes
    if total_failed > 0:
        bad_requests = sum(1 for r in valid_runs if r["Hit Bad Request"])
        early_term_percentage = round((bad_requests / total_failed) * 100, 1)
        print(f"Early Terminations (400 Errors): {early_term_percentage}% of failed runs ({bad_requests}/{total_failed})")
    else:
        print("Early Terminations (400 Errors): 0.0% (No failed runs to analyze)")
    
    print(f"Total Valid Prompts tested: {total_valid}")
    print(f"Overall Resolution Rate: {round((successes/total_valid)*100, 1)}% ({successes}/{total_valid})")
    print(f"Zero-Shot Success Rate: {round((zero_shots/total_valid)*100, 1)}% ({zero_shots}/{total_valid})")
    print(f"Autonomous Recovery Rate: {round((recovered/total_valid)*100, 1)}% ({recovered}/{total_valid})")

if __name__ == "__main__":
    main()