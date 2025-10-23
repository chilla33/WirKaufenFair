from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from . import store_models, store_schemas
from .database import get_db

router = APIRouter(prefix="/stores", tags=["stores"])


@router.post("", response_model=store_schemas.Store)
def create_store(
    payload: store_schemas.StoreCreate,
    db: Session = Depends(get_db)
):
    """Create a new store (imported from Maps API)"""
    # Check if store already exists
    existing = db.query(store_models.Store).filter(
        store_models.Store.full_name == payload.full_name
    ).first()
    
    if existing:
        return existing  # Return existing instead of error
    
    store = store_models.Store(**payload.dict())
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("", response_model=List[store_schemas.Store])
def list_stores(
    chain: Optional[str] = None,
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = 50,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    """Get list of stores, optionally filtered and sorted by distance"""
    q = db.query(store_models.Store).filter(store_models.Store.is_active == True)
    
    if chain:
        q = q.filter(store_models.Store.chain == chain)
    if city:
        q = q.filter(store_models.Store.city.like(f"%{city}%"))
    
    stores = q.limit(limit).all()
    
    # Sort by distance if lat/lng provided
    if lat and lng:
        import math
        
        def haversine_distance(store):
            if not store.latitude or not store.longitude:
                return float('inf')
            
            R = 6371  # Earth radius in km
            dLat = math.radians(store.latitude - lat)
            dLng = math.radians(store.longitude - lng)
            a = (math.sin(dLat/2) ** 2 + 
                 math.cos(math.radians(lat)) * math.cos(math.radians(store.latitude)) * 
                 math.sin(dLng/2) ** 2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            return R * c
        
        stores = [s for s in stores if haversine_distance(s) <= radius_km]
        stores.sort(key=haversine_distance)
    
    return stores


@router.get("/{store_id}", response_model=store_schemas.Store)
def get_store(store_id: int, db: Session = Depends(get_db)):
    """Get a single store by ID"""
    store = db.query(store_models.Store).filter(store_models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.delete("/{store_id}")
def delete_store(store_id: int, db: Session = Depends(get_db)):
    """Soft-delete a store (set is_active=False)"""
    store = db.query(store_models.Store).filter(store_models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store.is_active = False
    db.commit()
    return {"message": "Store deactivated"}
