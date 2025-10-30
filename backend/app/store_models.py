from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from .database import Base
import datetime


class Store(Base):
    """
    Hierarchisches Laden-System:
    - chain: Kette (z.B. "REWE", "Edeka", "Aldi")
    - location: Spezifischer Standort (z.B. "Drochtersen", "Hamburg Altona")
    - full_name: Wird generiert als "{chain} {location}"
    """
    __tablename__ = 'stores'
    
    id = Column(Integer, primary_key=True, index=True)
    chain = Column(String(100), nullable=False, index=True)  # REWE, Edeka, Aldi, ...
    location = Column(String(200), nullable=True, index=True)  # Drochtersen, Hamburg, ...
    full_name = Column(String(300), nullable=False, unique=True, index=True)  # "REWE Drochtersen"
    
    # Geo-Daten (optional, für Umkreissuche)
    address = Column(String(300), nullable=True)
    postal_code = Column(String(20), nullable=True)
    city = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Metadaten
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PriceHistory(Base):
    """
    Zeitbasierte Preisgültigkeit:
    - Preise haben ein valid_from und valid_until
    - Alte Preise werden nicht gelöscht, sondern archiviert
    - Ermöglicht Preisverlaufs-Charts
    """
    __tablename__ = 'price_history'
    
    id = Column(Integer, primary_key=True, index=True)
    product_identifier = Column(String(200), nullable=False, index=True)
    store_id = Column(Integer, nullable=False, index=True)  # FK zu stores
    store_chain = Column(String(100), nullable=False, index=True)  # Denormalisiert für Performance
    
    price = Column(Float, nullable=False)
    currency = Column(String(10), default='EUR')
    
    # Zeitliche Gültigkeit
    valid_from = Column(DateTime, nullable=False, index=True)
    valid_until = Column(DateTime, nullable=True, index=True)  # NULL = aktuell gültig
    
    # Herkunft
    source = Column(String(50), default='community')  # community, admin, crawler, receipt_ocr
    report_id = Column(Integer, nullable=True)  # FK zu price_reports falls aus Community
    verified_by = Column(String(200), nullable=True)
    
    # Confidence & Voting
    confidence = Column(Float, default=0.5)  # 0-1
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
