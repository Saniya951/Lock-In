import os
from typing import Annotated, TypedDict, List
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from knowledge_graph import KnowledgeGraphManager
from prompts import *
from termcolor import cprint
from pydantic import BaseModel, Field

# 1. A much lighter state! Just keeping track of the chat and the user's mastery.
class LearningState(TypedDict):
    messages: Annotated[list, add_messages]
    session_id: str
    user_context: str

class TechStackExtraction(BaseModel):
    name: str = Field(description="The name of the technology, language, or framework (e.g., 'React', 'Python', 'Docker').")
    concepts: List[str] = Field(description="The specific concepts or features related to this tech stack.")

class ConceptExtraction(BaseModel):
    tech_stacks: List[TechStackExtraction] = Field(description="List of tech stacks and their associated concepts extracted from the user's query.")

llm = ChatGroq(model="llama-3.3-70b-versatile")
memory = MemorySaver()

# 2. Node to fetch from Neo4j
def fetch_user_profile(state: LearningState):
    session_id = state.get("session_id")
    cprint(" Fetching user mastery profile from Neo4j...", "dark_grey")
    try:
        kg = KnowledgeGraphManager()
        known_data = kg.get_user_level(session_id)
        kg.close()
        
        if known_data:
            context = "\n".join([f"- {item['name']} (Mastery Level: {item['count']})" for item in known_data])
            cprint(f" Profile loaded. ({len(known_data)} concepts found)", "green")
        else:
            context = "Beginner profile. No prior concepts recorded."
            cprint(" Beginner profile loaded.", "yellow")
            
        return {"user_context": context}
    except Exception as e:
        cprint(f" KG Error: {e}", "red")
        return {"user_context": "Generic profile."}

# 3. Node to tutor the user
def tutor_agent(state: LearningState):
    context = state.get("user_context", "")
    messages = state.get("messages", [])
    session_id = state.get("session_id")
    
    # Grab the user's latest question
    latest_query = messages[-1].content
    
    # --- SMART CONCEPT EXTRACTION ---
    try:
        extracted = llm.with_structured_output(ConceptExtraction).invoke(
            f"Extract the core technical concepts and their parent tech stacks from this user question: '{latest_query}'"
        )
        
        # Check if the LLM actually found any tech stacks
        if extracted.tech_stacks:
            cprint(f"\n 🧠 Logging theoretical study for: {[ts.name for ts in extracted.tech_stacks]}...", "dark_grey")
            kg = KnowledgeGraphManager()
            
            # .model_dump() converts the Pydantic object into the exact dictionary structure Neo4j expects
            kg.record_theory_inquiry(session_id, extracted.model_dump())
            kg.close()
    except Exception as e:
        cprint(f" ⚠️ Concept extraction failed: {e}", "yellow")
    # --------------------------------
    
    # Generate the actual answer
    system_prompt = construct_tutor_system_prompt(context)
    conversation = [system_prompt] + messages
    
    response = llm.invoke(conversation)
    return {"messages": [response]}

# 4. Build the lean graph
builder = StateGraph(LearningState)
builder.add_node("fetch_profile", fetch_user_profile)
builder.add_node("tutor", tutor_agent)

builder.add_edge(START, "fetch_profile")
builder.add_edge("fetch_profile", "tutor")
builder.add_edge("tutor", END)

learning_agent = builder.compile(checkpointer=memory)

if __name__ == "__main__":
    cprint(f"\n{'='*50}", "magenta")
    cprint(" Welcome to the Lock-In Learning Module!", "cyan", attrs=["bold"])
    cprint(" Ask me anything. Type 'exit' to quit.", "cyan")
    cprint(f"{'='*50}\n", "magenta")
    
    # We use your hardcoded session ID for the memory checkpointer
    thread_id = '88c93d15-2f52-4d58-8b66-70ff9ac29103'
    config = {"configurable": {"thread_id": thread_id}}

    while True:
        try:
            # Standard input for the user so their typing isn't color-locked
            user_input = input("\n You: ")
            
            if user_input.lower() in ["quit", "exit"]:
                cprint("\n Exiting Learning Module...", "yellow", attrs=["bold"])
                break
                
            if not user_input.strip():
                continue

            # Format the input exactly how LangGraph's message reducer expects it
            current_input = {
                "messages": [{"role": "user", "content": user_input}],
                "session_id": thread_id 
            }
            
            cprint("\n🤖 Tutor: ", "magenta", attrs=["bold"], end="", flush=True)
            
            # Run the graph. stream_mode="updates" yields only the changes made by each node
            for event in learning_agent.stream(current_input, config=config, stream_mode="updates"):
                # We only want to print what the tutor_agent node outputs
                if "tutor" in event:
                    # The response is the last message in the list.
                    # We print this normally (without cprint) so markdown formatting stays readable.
                    print(event["tutor"]["messages"][-1].content)
                    
        except KeyboardInterrupt:
            cprint("\n\n Exiting...", "yellow", attrs=["bold"])
            break
        except Exception as e:
            cprint(f"\n\n Fatal Error: {e}", "red", attrs=["bold"])
            break