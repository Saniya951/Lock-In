import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REGISTRY_FILE = os.path.join(SCRIPT_DIR, "active_sandboxes.json")

# done for session persistence in e2b
# That is, if a sandbox has been created for this session before, then we fetch its ID so that we can warm boot it again
def get_sandbox_for_session(session_id: str) -> str | None:
    """Finds the Sandbox ID specifically for this session. """
    if not os.path.exists(REGISTRY_FILE):
        return None
    
    try:
        with open(REGISTRY_FILE, "r") as f:
            registry = json.load(f)
            return registry.get(session_id)
    except Exception:
        return None

def register_sandbox(session_id: str, sandbox_id: str):
    """Links a Sandbox ID to a Session ID."""
    registry = {}
    
    # Load existing registry if it exists
    if os.path.exists(REGISTRY_FILE):
        try:
            with open(REGISTRY_FILE, "r") as f:
                registry = json.load(f)
        except Exception:
            registry = {}
            
    # Update and save. also create file if it doesnt exist
    registry[session_id] = sandbox_id
    with open(REGISTRY_FILE, "w") as f:
        json.dump(registry, f, indent=4)
    
    print(f" Linked Session {session_id[:8]}... -> Sandbox {sandbox_id}")