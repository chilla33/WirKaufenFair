from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON
from .database import Base
import datetime


class ProductLocation(Base):
    __tablename__ = 'product_locations'
    id = Column(Integer, primary_key=True, index=True)
    product_identifier = Column(String(200), nullable=False)  # ean or name
    store_name = Column(String(200), nullable=False)
    aisle = Column(String(100), nullable=True)
    shelf_label = Column(String(100), nullable=True)
    photo_url = Column(String(1000), nullable=True)
    contributor = Column(String(200), nullable=True)
    status = Column(String(50), default='suggested')
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    verified_by = Column(String(200), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    # Product size fields
    size_amount = Column(Float, nullable=True)  # e.g. 150, 1.5, 500
    size_unit = Column(String(20), nullable=True)  # e.g. g, ml, l, kg, x
    # Price fields
    current_price = Column(Float, nullable=True)  # e.g. 1.99, 3.49
    price_currency = Column(String(10), default='EUR')  # EUR, USD, etc.
    price_history = Column(JSON, nullable=True)  # [{"date": "2025-10-21", "price": 1.99}, ...]
