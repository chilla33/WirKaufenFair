from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from .database import Base
import datetime


class ProductRating(Base):
    """User ratings for products - helps community find best products"""
    __tablename__ = 'product_ratings'
    
    id = Column(Integer, primary_key=True, index=True)
    product_identifier = Column(String(200), nullable=False, index=True)  # barcode or name
    store_name = Column(String(200), nullable=True, index=True)  # optional: rating per store
    rating = Column(Integer, nullable=False)  # 1-5 stars
    comment = Column(String(500), nullable=True)  # optional review text
    user_session = Column(String(100), nullable=True)  # simple session tracking (IP hash or cookie)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class PriceReport(Base):
    """Community-reported prices with voting system to prevent abuse"""
    __tablename__ = 'price_reports'
    
    id = Column(Integer, primary_key=True, index=True)
    product_identifier = Column(String(200), nullable=False, index=True)
    store_name = Column(String(200), nullable=False, index=True)
    reported_price = Column(Float, nullable=False)  # EUR
    size_amount = Column(Float, nullable=True)
    size_unit = Column(String(20), nullable=True)
    user_session = Column(String(100), nullable=True)
    upvotes = Column(Integer, default=0)  # confirmed by others
    downvotes = Column(Integer, default=0)  # flagged as wrong
    status = Column(String(50), default='pending')  # pending, pending_review, verified, rejected
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    # Zusätzliche Felder für bessere Anomalie-Erkennung
    photo_url = Column(String(500), nullable=True)  # Optional: Kassenbon-Foto als Beweis
    confidence_score = Column(Float, default=0.5)  # 0-1: Wie vertrauenswürdig ist die Meldung?
