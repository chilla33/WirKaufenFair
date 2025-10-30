from pydantic import BaseModel, EmailStr
from typing import Optional
import datetime


class SignupBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    notes: Optional[str] = None


class SignupCreate(SignupBase):
    pass


class Signup(SignupBase):
    id: int
    created_at: datetime.datetime

    class Config:
        # Pydantic V1 compatibility: in V2 this is 'from_attributes'
        # Use model_config for Pydantic v2 while keeping comments for clarity.
        model_config = {"from_attributes": True}
