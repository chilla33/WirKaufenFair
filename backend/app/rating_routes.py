"""
API endpoints for product ratings and community price reports
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from . import rating_models, rating_schemas
from .database import SessionLocal
import hashlib

router = APIRouter(prefix="/api/v1", tags=["Ratings & Prices"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_user_session(ip: str) -> str:
    """Simple session identifier from IP hash"""
    return hashlib.md5(ip.encode()).hexdigest()[:16]


# ===== RATINGS =====

@router.post("/ratings", response_model=rating_schemas.ProductRating)
def create_rating(
    payload: rating_schemas.ProductRatingCreate,
    db: Session = Depends(get_db)
):
    """Submit a product rating (1-5 stars + optional comment)"""
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    
    rating = rating_models.ProductRating(**payload.dict())
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


@router.get("/ratings", response_model=List[rating_schemas.ProductRating])
def list_ratings(
    product_identifier: Optional[str] = None,
    store_name: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """Get ratings for a product (optionally filtered by store)"""
    q = db.query(rating_models.ProductRating)
    if product_identifier:
        q = q.filter(rating_models.ProductRating.product_identifier == product_identifier)
    if store_name:
        q = q.filter(rating_models.ProductRating.store_name == store_name)
    
    items = q.order_by(rating_models.ProductRating.created_at.desc()).limit(limit).all()
    return items


@router.get("/ratings/stats", response_model=rating_schemas.ProductRatingStats)
def get_rating_stats(
    product_identifier: str,
    store_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get aggregated rating statistics for a product"""
    q = db.query(rating_models.ProductRating).filter(
        rating_models.ProductRating.product_identifier == product_identifier
    )
    if store_name:
        q = q.filter(rating_models.ProductRating.store_name == store_name)
    
    ratings = q.all()
    if not ratings:
        return rating_schemas.ProductRatingStats(
            product_identifier=product_identifier,
            store_name=store_name,
            average_rating=0,
            total_ratings=0,
            rating_distribution={1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        )
    
    total = len(ratings)
    avg = sum(r.rating for r in ratings) / total
    dist = {i: len([r for r in ratings if r.rating == i]) for i in range(1, 6)}
    
    return rating_schemas.ProductRatingStats(
        product_identifier=product_identifier,
        store_name=store_name,
        average_rating=round(avg, 2),
        total_ratings=total,
        rating_distribution=dist
    )


# ===== PRICE REPORTS =====

@router.post("/price_reports", response_model=rating_schemas.PriceReport)
def create_price_report(
    payload: rating_schemas.PriceReportCreate,
    db: Session = Depends(get_db)
):
    """Submit a price report for community verification"""
    if payload.reported_price <= 0:
        raise HTTPException(status_code=400, detail="Price must be positive")
    
    report = rating_models.PriceReport(**payload.dict())
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/price_reports", response_model=List[rating_schemas.PriceReport])
def list_price_reports(
    product_identifier: Optional[str] = None,
    store_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """Get price reports (optionally filtered)"""
    q = db.query(rating_models.PriceReport)
    if product_identifier:
        q = q.filter(rating_models.PriceReport.product_identifier == product_identifier)
    if store_name:
        q = q.filter(rating_models.PriceReport.store_name == store_name)
    if status:
        q = q.filter(rating_models.PriceReport.status == status)
    
    items = q.order_by(rating_models.PriceReport.created_at.desc()).limit(limit).all()
    return items


@router.post("/price_reports/{report_id}/vote")
def vote_price_report(
    report_id: int,
    vote: rating_schemas.PriceVote,
    db: Session = Depends(get_db)
):
    """Vote on a price report (up = confirm, down = flag as wrong)"""
    report = db.query(rating_models.PriceReport).filter(
        rating_models.PriceReport.id == report_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Price report not found")
    
    if vote.vote == "up":
        report.upvotes += 1
        # Auto-verify if enough upvotes
        if report.upvotes >= 3 and report.status == "pending":
            report.status = "verified"
            import datetime
            report.verified_at = datetime.datetime.utcnow()
            
            # Update ProductLocation with verified price
            from . import product_models
            pl = db.query(product_models.ProductLocation).filter(
                product_models.ProductLocation.product_identifier == report.product_identifier,
                product_models.ProductLocation.store_name == report.store_name
            ).first()
            if pl:
                pl.current_price = report.reported_price
                if report.size_amount:
                    pl.size_amount = report.size_amount
                if report.size_unit:
                    pl.size_unit = report.size_unit
    
    elif vote.vote == "down":
        report.downvotes += 1
        # Auto-reject if too many downvotes
        if report.downvotes >= 3 and report.status == "pending":
            report.status = "rejected"
    
    else:
        raise HTTPException(status_code=400, detail="Vote must be 'up' or 'down'")
    
    db.commit()
    return {
        "id": report.id,
        "upvotes": report.upvotes,
        "downvotes": report.downvotes,
        "status": report.status
    }


@router.get("/price_reports/best_price")
def get_best_price(
    product_identifier: str,
    store_name: str,
    db: Session = Depends(get_db)
):
    """Get the most trusted current price for a product at a store"""
    # First check if ProductLocation has a verified price
    from . import product_models
    pl = db.query(product_models.ProductLocation).filter(
        product_models.ProductLocation.product_identifier == product_identifier,
        product_models.ProductLocation.store_name == store_name
    ).first()
    
    if pl and pl.current_price:
        return {
            "source": "database",
            "price": pl.current_price,
            "currency": pl.price_currency or "EUR",
            "size_amount": pl.size_amount,
            "size_unit": pl.size_unit,
            "verified": True
        }
    
    # Otherwise get best community-reported price
    reports = db.query(rating_models.PriceReport).filter(
        rating_models.PriceReport.product_identifier == product_identifier,
        rating_models.PriceReport.store_name == store_name,
        rating_models.PriceReport.status != "rejected"
    ).order_by(
        rating_models.PriceReport.upvotes.desc(),
        rating_models.PriceReport.created_at.desc()
    ).first()
    
    if reports:
        return {
            "source": "community",
            "price": reports.reported_price,
            "currency": "EUR",
            "size_amount": reports.size_amount,
            "size_unit": reports.size_unit,
            "verified": reports.status == "verified",
            "upvotes": reports.upvotes,
            "downvotes": reports.downvotes
        }
    
    return {
        "source": "none",
        "price": None,
        "message": "No price data available"
    }
