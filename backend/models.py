from beanie import Document
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date

class User(Document):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    dob: date
    profession: str
    is_verified: bool = False
    verification_token: Optional[str] = None

    class Settings:
        name = "users"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    dob: date
    profession: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str