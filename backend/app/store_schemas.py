from pydantic import BaseModel
from typing import Optional


class StoreCreate(BaseModel):
    chain: str  # REWE, EDEKA, ...
    location: Optional[str] = None  # Drochtersen, Hamburg Altona, ...
    full_name: str  # "REWE Drochtersen"
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class Store(StoreCreate):
    id: int
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True
