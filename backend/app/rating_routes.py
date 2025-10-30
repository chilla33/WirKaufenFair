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
    # Diagnostic log for debugging missing stats calls
    try:
        print(f"ratings.stats called with product_identifier={product_identifier!r} store_name={store_name!r}")
    except Exception:
        pass
    q = db.query(rating_models.ProductRating).filter(
        rating_models.ProductRating.product_identifier == product_identifier
    )
    if store_name:
        q = q.filter(rating_models.ProductRating.store_name == store_name)
    try:
        ratings = q.all()
    except Exception as e:
        print(f"Error querying ratings for stats: {e}")
        ratings = []
    if not ratings:
        # return empty statistics (200) so frontends don't get 404
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
    
    # PLAUSIBILITÄTS-CHECK 1: Preis ist extrem unrealistisch
    if payload.reported_price < 0.10:
        raise HTTPException(status_code=400, detail="Preis zu niedrig (< 0.10 €) - bitte überprüfen")
    if payload.reported_price > 500:
        raise HTTPException(status_code=400, detail="Preis zu hoch (> 500 €) - bitte überprüfen")
    
    # PLAUSIBILITÄTS-CHECK 2: Vergleich mit bestehenden Preisen für gleiches Produkt
    existing = db.query(rating_models.PriceReport).filter(
        rating_models.PriceReport.product_identifier == payload.product_identifier,
        rating_models.PriceReport.store_name == payload.store_name,
        rating_models.PriceReport.status != "rejected"
    ).order_by(rating_models.PriceReport.created_at.desc()).limit(5).all()
    
    if existing:
        avg_price = sum(r.reported_price for r in existing) / len(existing)
        # Wenn neuer Preis mehr als 50% vom Durchschnitt abweicht → Warnung setzen
        deviation = abs(payload.reported_price - avg_price) / avg_price
        if deviation > 0.5:
            # Speichern mit Warnung, aber status bleibt pending und braucht mehr Votes
            report = rating_models.PriceReport(**payload.dict())
            report.status = "pending_review"  # Braucht mehr Bestätigungen
            db.add(report)
            db.commit()
            db.refresh(report)
            return report
    
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
        # STRENGERE Auto-Verify-Regel: Mindestens 5 Upvotes UND keine Downvotes
        if report.upvotes >= 5 and report.downvotes == 0 and report.status == "pending":
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
        # Auto-reject wenn mehr Downvotes als Upvotes UND mindestens 2 Downvotes
        if report.downvotes >= 2 and report.downvotes > report.upvotes and report.status == "pending":
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
    """
    Get the most trusted current price for a product at a store.
    WICHTIG: Berücksichtigt zeitliche Gültigkeit (max. 30 Tage alt)
    """
    import datetime
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    
    # First check if ProductLocation has a verified price
    from . import product_models
    pl = db.query(product_models.ProductLocation).filter(
        product_models.ProductLocation.product_identifier == product_identifier,
        product_models.ProductLocation.store_name == store_name
    ).first()
    
    if pl and pl.current_price:
        # Prüfe ob price_history existiert und Preis noch aktuell ist
        if hasattr(pl, 'price_history') and pl.price_history:
            history = pl.price_history
            try:
                # Ensure history is a list of dicts with ISO 'date' fields
                if isinstance(history, list) and len(history) > 0:
                    # Filter entries that have a valid ISO date
                    valid_entries = []
                    for entry in history:
                        try:
                            d = entry.get('date') if isinstance(entry, dict) else None
                            if not d:
                                continue
                            # fromisoformat may raise; catch per-entry
                            _ = datetime.datetime.fromisoformat(d)
                            valid_entries.append(entry)
                        except Exception:
                            # skip malformed entry
                            continue

                    if valid_entries:
                        latest = max(valid_entries, key=lambda x: x.get('date', ''))
                        latest_date = datetime.datetime.fromisoformat(latest['date'])
                        if latest_date < thirty_days_ago:
                            # Preis ist älter als 30 Tage → als veraltet markieren
                            return {
                                "source": "database",
                                "price": pl.current_price,
                                "currency": pl.price_currency or "EUR",
                                "size_amount": pl.size_amount,
                                "size_unit": pl.size_unit,
                                "verified": True,
                                "outdated": True,
                                "age_days": (datetime.datetime.utcnow() - latest_date).days,
                                "message": "Preis könnte veraltet sein (>30 Tage)"
                            }
            except Exception as e:
                # defensive: log and continue to return current price
                print(f"Warning: malformed price_history for ProductLocation id={getattr(pl,'id',None)}: {e}")
        
        return {
            "source": "database",
            "price": pl.current_price,
            "currency": pl.price_currency or "EUR",
            "size_amount": pl.size_amount,
            "size_unit": pl.size_unit,
            "verified": True
        }
    
    # Otherwise get best community-reported price (nur letzte 30 Tage)
    reports = db.query(rating_models.PriceReport).filter(
        rating_models.PriceReport.product_identifier == product_identifier,
        rating_models.PriceReport.store_name == store_name,
        rating_models.PriceReport.status != "rejected",
        rating_models.PriceReport.created_at >= thirty_days_ago  # ← WICHTIG!
    ).order_by(
        rating_models.PriceReport.upvotes.desc(),
        rating_models.PriceReport.created_at.desc()
    ).first()
    
    if reports:
        age_days = (datetime.datetime.utcnow() - reports.created_at).days
        return {
            "source": "community",
            "price": reports.reported_price,
            "currency": "EUR",
            "size_amount": reports.size_amount,
            "size_unit": reports.size_unit,
            "verified": reports.status == "verified",
            "upvotes": reports.upvotes,
            "downvotes": reports.downvotes,
            "age_days": age_days,
            "outdated": age_days > 14  # Warnung ab 14 Tagen
        }
    
    # Fallback: Prüfe ob es Preise für die KETTE gibt (nicht nur diesen Standort)
    store_chain = store_name.split()[0] if ' ' in store_name else store_name  # "REWE Drochtersen" → "REWE"
    
    chain_reports = db.query(rating_models.PriceReport).filter(
        rating_models.PriceReport.product_identifier == product_identifier,
        rating_models.PriceReport.store_name.like(f"{store_chain}%"),  # Alle REWE-Filialen
        rating_models.PriceReport.status == "verified",
        rating_models.PriceReport.created_at >= thirty_days_ago
    ).order_by(
        rating_models.PriceReport.created_at.desc()
    ).limit(5).all()
    
    if chain_reports:
        # Durchschnittspreis der Kette
        avg_price = sum(r.reported_price for r in chain_reports) / len(chain_reports)
        locations = list(set(r.store_name for r in chain_reports))
        
        return {
            "source": "chain_average",
            "price": round(avg_price, 2),
            "currency": "EUR",
            "verified": False,
            "estimated": True,
            "message": f"≈ Durchschnitt von {len(chain_reports)} {store_chain}-Filialen",
            "locations_sample": locations[:3],
            "outdated": False
        }
    
    return {
        "source": "none",
        "price": None,
        "message": "Kein Preis verfügbar"
    }
