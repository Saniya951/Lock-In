from typing import TypedDict, List, Literal, Dict, Any
from pydantic import BaseModel, Field

# --- Pydantic Models for LLM Output ---
class Plan(BaseModel):
    """The development plan."""
    project_goal: str = Field(description="The main goal of the project.")
    steps: List[str] = Field(description="High-level milestones (e.g. 'Setup', 'Backend', 'Frontend').")

class FileTask(BaseModel):
    file_name: str = Field(description="The relative path to the file (e.g., 'src/components/TodoList.js').")
    task_description: str = Field(description="Precise instructions on what to write in this file.")
    related_docs_topic: str = Field(description="The specific library/concept needed (e.g., 'React useState hook' or 'Flask SQLAlchemy').")

class TaskPlan(BaseModel):
    """The File Manifest."""
    plan: Plan = Field(description="The original high-level plan.")
    implementation_steps: List[FileTask] = Field(description="The ordered list of files to be created.")

class ExecutionCommands(BaseModel):
    install_cmd: str = Field(description="The command to install dependencies (e.g., 'npm install && pip install -r requirements.txt')")
    run_cmd: str = Field(description="The command to start the application (e.g., 'npm start' or 'gunicorn app:app')")

class ResearchQueries(BaseModel):
    """The list of research queries."""
    queries: List[str] = Field(description="A list of 3-5 search queries to research the task.")

class SiteSelection(BaseModel):
    """Selected sites for Tavily search."""
    sites: List[str] = Field(description="List of site names to search, e.g., ['React', 'Flask'].")
    
# --- Pydantic model for the router ---
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

class CodeFile(BaseModel):
    """A single file of code."""
    file_name: str = Field(description="The full path and name of the file, e.g., 'src/app.py' or 'requirements.txt'")
    content: str = Field(description="The complete code or content for this file.")

class GeneratedCode(BaseModel):
    """A list of code files to be written to disk."""
    files: List[CodeFile] = Field(description="A list of code files to be generated.")

class TavilyResults(BaseModel):
    """Results from Tavily real-time search."""
    results: List[Dict[str, str]] = Field(description="List of search results with 'site', 'content', and 'source'.")

class GraphState(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        user_prompt: The initial prompt from the user.
        route: The decision made by the router (build, debug, learn).
        plan: The high-level plan (for the build route).
        task_plan: The detailed task-level plan (for the build route).
        retrieved_context: The combined string of retrieved documents.
        search_method: The chosen search method ("default" or "advance").
    """
    # --- INPUT ---
    session_id: str
    user_prompt: str
    route: str | None
    plan: Plan | None
    task_queue: List[Dict[str, Any]]  #Replaces 'task_plan'. This is the list of files to build.
    current_task_index: int          # Starts at 0
    # research_queries: List[str] | None
    retrieved_context: str | None     #This is overwritten in every loop of the coder. It only holds docs relevant to the CURRENT file.
    search_method: bool | None
    # --- OUTPUTS ---
    # We only store paths, e.g. ["src/App.js", "package.json"]
    # NOT the actual code content.
    completed_files: List[str]

    # --- DEBUGGING / EVALUATION ---
    execution_logs: str
    error_report: str
    iteration_count: int
    status: str
    
    preview_url: str