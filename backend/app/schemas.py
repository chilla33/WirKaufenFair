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
        orm_mode = True
