from typing import TypedDict, List, Literal, Dict, Any
from pydantic import BaseModel, Field

# --- Pydantic Models for LLM Output ---
class Plan(BaseModel):
    """The development plan."""
    project_goal: str = Field(description="The main goal of the project.")
    steps: List[str] = Field(description="A list of high-level development steps.")

class TaskPlan(BaseModel):
    """The detailed task plan."""
    plan: Plan = Field(description="The original high-level plan.")
    implementation_steps: List[dict] = Field(description="A detailed list of implementation tasks, each with a 'task_description' and 'details'.")

class ResearchQueries(BaseModel):
    """The list of research queries."""
    queries: List[str] = Field(description="A list of 3-5 search queries to research the task.")

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

# --- Graph State ---

class GraphState(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        user_prompt: The initial prompt from the user.
        route: The decision made by the router (build, debug, learn).
        plan: The high-level plan (for the build route).
        task_plan: The detailed task-level plan (for the build route).
        research_queries: List of queries for the researcher.
        retrieved_context: The combined string of retrieved documents.
        retrieved_docs: A list of dicts with {"content": ..., "source": ...}
    """
    user_prompt: str
    route: str | None  #To store the router's decision
    plan: Plan | None
    task_plan: TaskPlan | None
    research_queries: List[str] | None
    retrieved_context: str | None
    retrieved_docs: List[Dict[str, Any]] | None #to store content and metadata
    generated_code: GeneratedCode | None