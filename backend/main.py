from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from bson import ObjectId
from jose import JWTError, jwt
from models import User, UserCreate, UserLogin, Token, RefreshTokenRequest, Project, File, ProjectCreate, FileUpsert
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import anyio
import sys
import ssl
import os
import json
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from auth import get_password_hash, create_access_token, create_refresh_token, generate_verification_token, send_verification_email, authenticate_user
from config import MONGODB_URL, DATABASE_NAME, SECRET_KEY, ALGORITHM
import uvicorn

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from agent.graph import run_graph, set_file_callback
from agent.knowledge_graph import KnowledgeGraphManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        # Create SSL context
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        client = AsyncIOMotorClient(
            MONGODB_URL,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
        await init_beanie(database=client[DATABASE_NAME], document_models=[User, Project, File])
        print("MongoDB connected successfully")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        print("Warning: Running without database. Auth endpoints will not work.")
        client = None
    
    yield
    
    # Shutdown
    if client:
        client.close()

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless" # Better for iframes
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class GraphRequest(BaseModel):
    prompt: str
    search_method: bool = False  # False (0) for vectordb (default), True (1) for tavily
    thread_id: Optional[str] = None  # Optional persistent thread ID for multi-turn conversations


def serialize_project(project: Project) -> dict:
    return {
        "id": str(project.id),
        "user_id": project.user_id,
        "name": project.name,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "last_opened_at": project.last_opened_at.isoformat(),
        "is_deleted": project.is_deleted,
    }


def serialize_file(file_doc: File) -> dict:
    return {
        "id": str(file_doc.id),
        "project_id": file_doc.project_id,
        "path": file_doc.path,
        "content": file_doc.content,
        "language": file_doc.language,
        "updated_at": file_doc.updated_at.isoformat(),
    }


def guess_language_from_path(path: str) -> Optional[str]:
    normalized_path = path.lower()
    if normalized_path.endswith(".jsx"):
        return "javascriptreact"
    if normalized_path.endswith(".tsx"):
        return "typescriptreact"
    if normalized_path.endswith(".ts"):
        return "typescript"
    if normalized_path.endswith(".js"):
        return "javascript"
    if normalized_path.endswith(".py"):
        return "python"
    if normalized_path.endswith(".css"):
        return "css"
    if normalized_path.endswith(".html"):
        return "html"
    if normalized_path.endswith(".json"):
        return "json"
    return None


async def get_current_user_email(token: str = Depends(oauth2_scheme)) -> str:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = await User.find_one(User.email == email)
    if not user:
        raise credentials_error

    return email


async def get_project_for_user(project_id: str, user_email: str) -> Project:
    try:
        object_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project id")

    project = await Project.find_one(Project.id == object_id, Project.user_id == user_email, Project.is_deleted == False)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def touch_project_last_opened(project: Project) -> None:
    now = datetime.utcnow()
    project.last_opened_at = now
    await project.save()


@app.post("/projects")
async def create_project(payload: ProjectCreate, user_email: str = Depends(get_current_user_email)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")

    now = datetime.utcnow()
    project = Project(
        user_id=user_email,
        name=name,
        created_at=now,
        updated_at=now,
        last_opened_at=now,
        is_deleted=False,
    )
    await project.insert()
    return {"project": serialize_project(project)}


@app.get("/projects")
async def list_projects(user_email: str = Depends(get_current_user_email)):
    projects = await Project.find(
        Project.user_id == user_email,
        Project.is_deleted == False,
    ).sort(-Project.last_opened_at).to_list()
    return {"projects": [serialize_project(project) for project in projects]}


@app.get("/projects/{project_id}")
async def get_project(project_id: str, user_email: str = Depends(get_current_user_email)):
    project = await get_project_for_user(project_id, user_email)
    await touch_project_last_opened(project)
    return {"project": serialize_project(project)}


@app.get("/projects/{project_id}/files")
async def get_project_files(project_id: str, user_email: str = Depends(get_current_user_email)):
    project = await get_project_for_user(project_id, user_email)
    await touch_project_last_opened(project)

    files = await File.find(File.project_id == project_id).sort(File.path).to_list()
    return {"files": [serialize_file(file_doc) for file_doc in files]}


@app.post("/files")
async def upsert_file(payload: FileUpsert, user_email: str = Depends(get_current_user_email)):
    project = await get_project_for_user(payload.project_id, user_email)
    now = datetime.utcnow()
    language = payload.language or guess_language_from_path(payload.path)

    existing_file = await File.find_one(File.project_id == payload.project_id, File.path == payload.path)

    if existing_file:
        existing_file.content = payload.content
        existing_file.language = language
        existing_file.updated_at = now
        await existing_file.save()
        file_doc = existing_file
    else:
        file_doc = File(
            project_id=payload.project_id,
            path=payload.path,
            content=payload.content,
            language=language,
            updated_at=now,
        )
        await file_doc.insert()

    project.updated_at = now
    project.last_opened_at = now
    await project.save()

    return {"file": serialize_file(file_doc)}


@app.delete("/files/{file_id}")
async def delete_file(file_id: str, user_email: str = Depends(get_current_user_email)):
    try:
        object_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file id")

    file_doc = await File.get(object_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    project = await get_project_for_user(file_doc.project_id, user_email)
    await file_doc.delete()

    project.updated_at = datetime.utcnow()
    await project.save()

    return {"message": "File deleted"}

@app.post("/signup", response_model=dict)
async def signup(user: UserCreate):
    # Check if user already exists
    existing_user = await User.find_one(User.email == user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user.password)
    
    # Generate verification token
    token = generate_verification_token()
    
    # Create user
    new_user = User(
        email=user.email,
        password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        dob=user.dob,
        profession=user.profession,
        verification_token=token
    )
    await new_user.insert()
    
    # Send verification email
    await send_verification_email(user.email, token)
    
    return {"message": "Verification email sent"}

@app.get("/verify/{token}", response_class=HTMLResponse)
async def verify_email(token: str):
    user = await User.find_one(User.verification_token == token)
    if not user:
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Verification Failed</title>
            <style>
                body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #050505; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; }
                .container { text-align: center; max-width: 500px; padding: 40px; }
                h1 { font-size: 32px; margin-bottom: 16px; }
                p { color: rgba(255,255,255,0.6); margin-bottom: 32px; }
                a { display: inline-block; padding: 12px 32px; background: linear-gradient(to right, #6366f1, #22d3ee); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>❌ Invalid Verification Link</h1>
                <p>This verification link is invalid or has already been used.</p>
                <a href="http://localhost:5173">Return to Lock-In</a>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content, status_code=400)
    
    user.is_verified = True
    user.verification_token = None
    await user.save()
    
    # Generate JWT tokens for auto-login
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Email Verified</title>
        <style>
            body {{ margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #050505; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; }}
            .container {{ text-align: center; max-width: 500px; padding: 40px; }}
            .logo {{ width: 64px; height: 64px; background: linear-gradient(to bottom right, #6366f1, #22d3ee); border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; font-size: 32px; }}
            h1 {{ font-size: 32px; margin-bottom: 16px; }}
            p {{ color: rgba(255,255,255,0.6); margin-bottom: 32px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">✨</div>
            <h1>✅ Email Verified Successfully!</h1>
            <p>Logging you in...</p>
        </div>
        <script>
            window.location.href = 'http://localhost:5173?token={access_token}&refresh_token={refresh_token}';
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.post("/login", response_model=Token)
async def login(user: UserLogin):
    authenticated_user = await authenticate_user(user.email, user.password)
    if not authenticated_user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not authenticated_user.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified")
    
    access_token = create_access_token(data={"sub": authenticated_user.email})
    refresh_token = create_refresh_token(data={"sub": authenticated_user.email})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@app.post("/refresh", response_model=Token)
async def refresh_access_token(payload: RefreshTokenRequest):
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token_payload = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = token_payload.get("sub")
        token_type = token_payload.get("type")
        if not email or token_type != "refresh":
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = await User.find_one(User.email == email)
    if not user or not user.is_verified:
        raise credentials_error

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/home")
async def home(token: str = Depends(oauth2_scheme)):
    return {"message": "Welcome to home page"}


@app.get("/me")
async def get_me(user_email: str = Depends(get_current_user_email)):
    user = await User.find_one(User.email == user_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "dob": user.dob.isoformat() if user.dob else None,
        "profession": user.profession,
        "is_verified": user.is_verified,
    }


@app.get("/me/knowledge-graph")
async def get_my_knowledge_graph(user_email: str = Depends(get_current_user_email)):
    kg = None
    try:
        kg = KnowledgeGraphManager()
        graph_data = kg.get_user_graph(user_email)
        return graph_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to fetch knowledge graph: {str(e)}")
    finally:
        if kg:
            kg.close()

@app.post("/prompt")
async def run_graph_endpoint(payload: GraphRequest, user_email: str = Depends(get_current_user_email)):
    result = await anyio.to_thread.run_sync(
        run_graph, 
        payload.prompt, 
        payload.search_method,
        payload.thread_id,
        user_email
    )
    
    # Extract thread_id and session_id from result
    thread_id = result.get("thread_id")
    session_id = result.get("session_id")
    
    # Return result with thread management info
    return {
        "result": result,
        "thread_id": thread_id,
        "session_id": session_id,
        "preview_url": result.get("preview_url"),
    }

@app.post("/prompt/stream")
async def run_graph_stream_endpoint(payload: GraphRequest, user_email: str = Depends(get_current_user_email)):
    """Stream file creation events in real-time using Server-Sent Events with persistent thread support"""
    
    async def event_generator():
        file_queue = asyncio.Queue()
        session_info = {"thread_id": None, "session_id": None}
        explanation_holder = {"summary": ""}
        
        # Get the current event loop for the callback to use
        loop = asyncio.get_event_loop()
        
        def streaming_callback(event_type: str, data: dict):
            """Enhanced callback that captures explainer output"""
            try:
                filename = data.get('filename', 'N/A')
                print(f"[BACKEND CALLBACK] Received event: {event_type}, file: {filename}")
                
                # Capture explanation output
                if event_type == "explanation_complete":
                    explanation_holder["summary"] = data.get("content", "")
                
                # Queue all events for streaming
                asyncio.run_coroutine_threadsafe(
                    file_queue.put({"type": event_type, "data": data}),
                    loop
                )
                print(f"[BACKEND CALLBACK] Successfully queued: {filename}")
            except Exception as e:
                print(f"Error in callback: {e}")
        
        # Set the callback for this request
        set_file_callback(streaming_callback)
        
        # Run the agent in a background thread
        async def run_agent():
            try:
                result = await anyio.to_thread.run_sync(
                    run_graph,
                    payload.prompt, 
                    payload.search_method,
                    payload.thread_id,
                    user_email
                )
                thread_id = result.get('thread_id')
                session_id = result.get('session_id')
                preview_url = result.get('preview_url')
                session_info['thread_id'] = thread_id
                session_info['session_id'] = session_id
                
                # Send completion event with thread info
                await file_queue.put({
                    "type": "complete", 
                    "data": {
                        "thread_id": thread_id,
                        "session_id": session_id,
                        "preview_url": preview_url,
                        "status": result.get("status", "unknown"),
                        "explanation": explanation_holder.get("summary", "")
                    }
                })
            except Exception as e:
                await file_queue.put({"type": "error", "data": {"error": str(e)}})
            finally:
                set_file_callback(None)  # Clear callback
        
        # Start agent in background
        agent_task = asyncio.create_task(run_agent())
        
        try:
            while True:
                event = await file_queue.get()
                event_type = event["type"]
                
                # Send SSE formatted message
                yield f"data: {json.dumps(event)}\n\n"
                
                if event_type == "complete" or event_type == "error":
                    break
        finally:
            # Clean up
            if not agent_task.done():
                agent_task.cancel()
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/session/{session_id}/files")
async def get_session_files(session_id: str):
    """Get all generated code files for a session (excluding plan directory)"""
    code_dir = os.path.join(os.path.dirname(__file__), "..", "agent", "output", session_id, "code")
    
    if not os.path.exists(code_dir):
        raise HTTPException(status_code=404, detail="Session not found")
    
    files = {}
    for root, _, filenames in os.walk(code_dir):
        for filename in filenames:
            filepath = os.path.join(root, filename)
            rel_path = os.path.relpath(filepath, code_dir)
            # Normalize to forward slashes for consistency
            rel_path = rel_path.replace('\\', '/')
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    files[rel_path] = f.read()
            except:
                pass
    
    return {"files": files}

@app.get("/session/{session_id}/frontend")
async def get_frontend_embed(session_id: str):
    """Return HTML iframe embed for webcontainer with frontend files"""
    output_dir = os.path.join(os.path.dirname(__file__), "..", "agent", "output", session_id, "code")
    
    if not os.path.exists(output_dir):
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get frontend files (React/Vue/etc)
    frontend_files = {}
    for root, _, filenames in os.walk(output_dir):
        for filename in filenames:
            # Only include frontend files
            if filename.endswith(('.jsx', '.js', '.json', '.html', '.css', '.tsx', '.ts')):
                filepath = os.path.join(root, filename)
                rel_path = os.path.relpath(filepath, output_dir)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        frontend_files[rel_path] = f.read()
                except:
                    pass
    
    # Create StackBlitz embed link
    # For now, return files that can be used to create embed
    return {"files": frontend_files, "session_id": session_id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)