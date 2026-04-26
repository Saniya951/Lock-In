from beanie import Document
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime
from pymongo import IndexModel

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
    refresh_token: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class Project(Document):
    user_id: str
    name: str
    created_at: datetime
    updated_at: datetime
    last_opened_at: datetime
    is_deleted: bool = False

    class Settings:
        name = "projects"
        indexes = [
            IndexModel([("user_id", 1)]),
            IndexModel([("last_opened_at", -1)]),
        ]


class File(Document):
    project_id: str
    path: str
    content: str
    language: Optional[str] = None
    updated_at: datetime

    class Settings:
        name = "files"
        indexes = [
            IndexModel([("project_id", 1)]),
            IndexModel([("project_id", 1), ("path", 1)], unique=True),
        ]


class ProjectCreate(BaseModel):
    name: str


class FileUpsert(BaseModel):
    project_id: str
    path: str
    content: str
    language: Optional[str] = None