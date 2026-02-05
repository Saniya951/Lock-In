from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User, UserCreate, UserLogin, Token
from auth import get_password_hash, create_access_token, generate_verification_token, send_verification_email, authenticate_user
from config import MONGODB_URL, DATABASE_NAME
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.on_event("startup")
async def startup_event():
    client = AsyncIOMotorClient(MONGODB_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])

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
    
    # Generate JWT token for auto-login
    access_token = create_access_token(data={"sub": user.email})
    
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
            window.location.href = 'http://localhost:5173?token={access_token}';
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
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/home")
async def home(token: str = Depends(oauth2_scheme)):
    return {"message": "Welcome to home page"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)