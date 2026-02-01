from beanie import Document
from pydantic import BaseModel, EmailStr
from typing import Optional

class User(Document):
    email: EmailStr
    password: str
    is_verified: bool = False
    verification_token: Optional[str] = None

    class Settings:
        name = "users"

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str