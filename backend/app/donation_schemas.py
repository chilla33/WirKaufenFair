from pydantic import BaseModel
from typing import Optional
import datetime


class DonationCreate(BaseModel):
    amount: float
    currency: Optional[str] = 'EUR'
    donor_name: Optional[str] = None
    donor_email: Optional[str] = None
    provider: Optional[str] = None
    provider_tx: Optional[str] = None


class Donation(DonationCreate):
    id: int
    created_at: datetime.datetime

    class Config:
        # Pydantic V1 compatibility: in V2 this is 'from_attributes'
        model_config = {"from_attributes": True}
