from sqlalchemy import Column, Integer, String, Text, DateTime
from .database import Base
import datetime


class Signup(Base):
    __tablename__ = 'signups'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
