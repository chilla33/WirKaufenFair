from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ProductRatingCreate(BaseModel):
    product_identifier: str
    store_name: Optional[str] = None
    rating: int  # 1-5
    comment: Optional[str] = None
    user_session: Optional[str] = None


class ProductRating(BaseModel):
    id: int
    product_identifier: str
    store_name: Optional[str]
    rating: int
    comment: Optional[str]
    user_session: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ProductRatingStats(BaseModel):
    """Aggregated rating statistics for a product"""
    product_identifier: str
    store_name: Optional[str]
    average_rating: float
    total_ratings: int
    rating_distribution: dict  # {1: count, 2: count, ...}


class PriceReportCreate(BaseModel):
    product_identifier: str
    store_name: str
    reported_price: float
    size_amount: Optional[float] = None
    size_unit: Optional[str] = None
    user_session: Optional[str] = None


class PriceReport(BaseModel):
    id: int
    product_identifier: str
    store_name: str
    reported_price: float
    size_amount: Optional[float]
    size_unit: Optional[str]
    user_session: Optional[str]
    upvotes: int
    downvotes: int
    status: str
    verified_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PriceVote(BaseModel):
    vote: str  # "up" or "down"
