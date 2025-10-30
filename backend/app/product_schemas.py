from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import datetime


class ProductLocationBase(BaseModel):
    product_identifier: str
    store_name: str
    aisle: Optional[str] = None
    shelf_label: Optional[str] = None
    photo_url: Optional[str] = None
    contributor: Optional[str] = None
    size_amount: Optional[float] = None
    size_unit: Optional[str] = None
    current_price: Optional[float] = None
    price_currency: Optional[str] = 'EUR'
    price_history: Optional[List[Dict[str, Any]]] = None


class ProductLocationCreate(ProductLocationBase):
    pass


class ProductLocation(ProductLocationBase):
    id: int
    status: str
    upvotes: int
    downvotes: int
    verified_by: Optional[str] = None
    verified_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        # Pydantic V1 compatibility: in V2 this is 'from_attributes'
        model_config = {"from_attributes": True}
