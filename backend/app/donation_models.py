from sqlalchemy import Column, Integer, String, Float, DateTime
from .database import Base
import datetime


class Donation(Base):
    __tablename__ = 'donations'
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default='EUR')
    donor_name = Column(String(200), nullable=True)
    donor_email = Column(String(200), nullable=True)
    provider = Column(String(50), nullable=True)  # e.g., paypal, stripe, offline
    provider_tx = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
