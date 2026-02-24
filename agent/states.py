from typing import TypedDict, List, Literal, Dict, Any, Annotated, Optional
from pydantic import BaseModel, Field
import operator
from enum import Enum

# pydantic models for llm output
class QueryRoute(BaseModel):
    """The routing decision for the user's query."""
    route: Literal["build", "debug", "learn"] = Field(
        description=(
            "The category of the user's request. "
            "'build' for new features or code. "
            "'debug' for fixing errors. "
            "'learn' for general questions."
        )
    )

class Plan(BaseModel):
    """The development plan."""
    project_goal: str = Field(description="The main goal of the project.")
    tech_stack: Literal["react_flask", "python_script", "react_only", "node_backend"] = Field(
        description="The specific technology stack to be used."
    )
    steps: List[str] = Field(description="High-level milestones (e.g. 'Setup', 'Backend', 'Frontend').")

class FileTask(BaseModel):
    file_name: str = Field(description="The relative path to the file (e.g., 'src/components/TodoList.js').")
    task_description: str = Field(description="Precise instructions on what to write in this file.")
    related_docs_topic: str = Field(description="The specific library/concept needed (e.g., 'React useState hook' or 'Flask SQLAlchemy').")

class TaskPlan(BaseModel):
    """The File Manifest."""
    plan: Plan = Field(description="The original high-level plan.")
    implementation_steps: List[FileTask] = Field(description="The ordered list of files to be created.")
    dependencies: List[str] = Field(description="A list of PACKAGE NAMES ONLY for pip or npm (e.g., ['flask', 'pandas', 'react', 'axios']).")

class QATask(BaseModel):
    test_file_name: str = Field(description="The path for the test file (e.g., 'test_utils.py').")
    target_file: str = Field(description="The existing source file being tested (e.g., 'src/utils.py').")
    test_scenarios: List[str] = Field(description="List of specific conditions to test.")

class QAPlan(BaseModel):
    """Output for Prompt 2: The Test Strategy."""
    qa_tasks: List[QATask] = Field(description="The mapping of source files to test files.")

class ErrorCategory(str, Enum):
    INFRA = "infra"         # pip/npm failed, bad requirements
    SYNTAX = "syntax"       # compilation error, bad imports, typos
    RUNTIME = "runtime"     # code crashed while running (TypeError, etc)
    LOGICAL = "logical"     # tests failed an assertion (math is wrong)
    TIMEOUT = "timeout"     # infinite loop, UI blocked the terminal
    NONE = "none"           # passed!

class EvaluationResult(BaseModel):
    status: Literal["pass", "fail"] = Field(description="Did the execution pass all tests?")
    category: ErrorCategory = Field(description="The structural layer where the code failed.")
    feedback: str = Field(description="A concise summary of exactly what broke and why along with the filename if present in logs")

class DebugTask(BaseModel):
    file_name: str = Field(description="The exact relative path of the existing file to patch")
    bug_analysis: str = Field(description="Briefly explain exactly what line or concept is causing the error in this specific file.") # <-- Forces the LLM to think first
    task_description: str = Field(description="Precise, step-by-step instructions on what to change or replace to fix the specific error.")
    related_docs_topic: str = Field(description="The specific library or syntax concept needed to fix the bug.")

class DebugPlan(BaseModel):
    """The Bug Fix Plan."""
    implementation_steps: List[DebugTask] = Field(description="The list of files that need to be modified to resolve the error.")

# Layer = Literal["infrastructure", "test", "application"]

# class Failure(BaseModel):
#     symptom: str
#     layer: Layer
#     confidence: float
#     evidence: List[str]
#     requires_code_change: bool

class ExecutionResult(BaseModel):
    tests_ran: bool
    tests_passed: bool
    exit_code: int
    logs: str
    environment_ok: bool

class GraphState(TypedDict):
    """
    Represents the state of our graph.
    """

    # try not to comment out any of these or else the app will break TT
    session_id: str
    user_prompt: str

    route: str | None
    plan: Plan | None
    task_queue: List[Dict[str, Any]]  #Replaces 'task_plan'. This is the list of files to build.
    current_task_index: int          # used by coder to loop through the tasks in the task queue

    dependencies: List[str]       # Output of Architect Call 1

    qa_plan: List[dict]

    search_method: bool | None
    completed_files: Annotated[list, operator.add]

    # --- DEBUGGING / EVALUATION ---
    execution_result: Optional[ExecutionResult] = None
    # failure: Optional[Failure] = None

    iteration_count: int = 0
    attempt_history: Annotated[List[dict], operator.add]
    error_report: str
    status: str

    sandbox_id: str | None