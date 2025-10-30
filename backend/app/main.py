from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas
from . import product_models
from . import product_schemas
from . import donation_models
from . import donation_schemas
from pydantic import ValidationError
from fastapi import Body, Request
from fastapi import UploadFile, File
import datetime
from .database import SessionLocal, engine
import os
from pathlib import Path
import uuid
from fastapi.staticfiles import StaticFiles
import base64
from starlette.responses import Response
from fastapi.responses import FileResponse
from .openfoodfacts import OpenFoodFactsClient
from .openfoodfacts_routes import router as off_router
from .rating_routes import router as rating_router
from . import rating_models

models.Base.metadata.create_all(bind=engine)
product_models.Base = getattr(product_models, 'Base', None)
try:
    product_models.Base.metadata.create_all(bind=engine)
except Exception:
    pass
donation_models.Base = getattr(donation_models, 'Base', None)
try:
    donation_models.Base.metadata.create_all(bind=engine)
except Exception:
    pass
rating_models.Base = getattr(rating_models, 'Base', None)
try:
    rating_models.Base.metadata.create_all(bind=engine)
except Exception:
    pass

app = FastAPI(title="WirkaufenFair API")


# HTTP Basic protect admin static pages when ADMIN_USER/ADMIN_PASSWORD env vars are set.
# If both are set, any request path starting with /admin will require a Basic auth header.
@app.middleware("http")
async def admin_basic_auth_middleware(request, call_next):
    try:
        admin_user = os.getenv('ADMIN_USER')
        admin_pass = os.getenv('ADMIN_PASSWORD')
        path = request.url.path or ''
        if admin_user and admin_pass and path.startswith('/admin'):
            auth = request.headers.get('authorization')
            if not auth or not auth.lower().startswith('basic '):
                return Response(status_code=401, headers={'WWW-Authenticate': 'Basic realm="Admin"'}, content='Unauthorized')
            try:
                token = auth.split(' ', 1)[1].strip()
                decoded = base64.b64decode(token).decode('utf-8')
                user, sep, pwd = decoded.partition(':')
                if sep != ':' or user != admin_user or pwd != admin_pass:
                    return Response(status_code=401, headers={'WWW-Authenticate': 'Basic realm="Admin"'}, content='Unauthorized')
            except Exception:
                return Response(status_code=401, headers={'WWW-Authenticate': 'Basic realm="Admin"'}, content='Unauthorized')
    except Exception:
        # if middleware errors, fail open to avoid locking out in dev
        pass
    return await call_next(request)

# Serve frontend static files (if frontend folder exists in repo root)
FRONTEND_DIR = Path(__file__).resolve().parents[2] / 'frontend'
if FRONTEND_DIR.exists():
    # mount admin folder separately (to serve /admin/... paths)
    ADMIN_DIR = FRONTEND_DIR / 'admin'
    if ADMIN_DIR.exists():
        app.mount('/admin', StaticFiles(directory=str(ADMIN_DIR), html=True), name='admin')
    # mount rest of frontend at /static
    app.mount('/static', StaticFiles(directory=str(FRONTEND_DIR), html=True), name='frontend')
    # mount /assets directly so absolute asset paths work
    ASSETS_DIR = FRONTEND_DIR / 'assets'
    if ASSETS_DIR.exists():
        app.mount('/assets', StaticFiles(directory=str(ASSETS_DIR)), name='assets')
    # serve /style.css for legacy absolute path references
    STYLE_PATH = FRONTEND_DIR / 'style.css'
    if STYLE_PATH.exists():
        @app.get('/style.css')
        def style_css():
            return FileResponse(str(STYLE_PATH))
    # serve /favicon.ico if available under assets
    FAVICON_ICO = ASSETS_DIR / 'favicon.ico' if ASSETS_DIR.exists() else None
    FAVICON_PNG = ASSETS_DIR / 'favicon.png' if ASSETS_DIR.exists() else None
    if FAVICON_ICO and FAVICON_ICO.exists():
        @app.get('/favicon.ico')
        def favicon_ico():
            return FileResponse(str(FAVICON_ICO))
    elif FAVICON_PNG and FAVICON_PNG.exists():
        @app.get('/favicon.ico')
        def favicon_png():
            return FileResponse(str(FAVICON_PNG))
    @app.get('/')
    def root_index():
        return Response(status_code=302, headers={'Location': '/static/index.html'})

    @app.get('/admin')
    def admin_root():
        return Response(status_code=302, headers={'Location': '/admin/product_locations.html'})

# Uploads: configure directory and mount static serving
UPLOAD_DIR = Path(__file__).resolve().parents[2] / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount('/uploads', StaticFiles(directory=str(UPLOAD_DIR)), name='uploads')

ALLOWED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MiB


@app.post('/api/v1/uploads')
async def upload_image(file: UploadFile = File(...)):
    # Basic type/size checks
    ct = (file.content_type or '').lower()
    if not ct.startswith('image/'):
        raise HTTPException(status_code=400, detail='Only image uploads are allowed')
    # Read file into memory to size-check (simple MVP)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='File too large (max 5 MiB)')
    # Extension sanitation
    ext = Path(file.filename or '').suffix.lower()
    if ext not in ALLOWED_EXTS:
        # try to guess from content type
        if '/jpeg' in ct:
            ext = '.jpg'
        elif '/png' in ct:
            ext = '.png'
        elif '/webp' in ct:
            ext = '.webp'
        elif '/gif' in ct:
            ext = '.gif'
        else:
            raise HTTPException(status_code=400, detail='Unsupported image type')
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = UPLOAD_DIR / fname
    with open(fpath, 'wb') as f:
        f.write(data)
    return {"url": f"/uploads/{fname}"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post('/api/v1/signup', response_model=schemas.Signup)
def create_signup(signup: schemas.SignupCreate, db: Session = Depends(get_db)):
    db_signup = models.Signup(name=signup.name, email=signup.email, role=signup.role, notes=signup.notes)
    db.add(db_signup)
    db.commit()
    db.refresh(db_signup)
    return db_signup


@app.get('/api/v1/signups', response_model=list[schemas.Signup])
def list_signups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items = db.query(models.Signup).offset(skip).limit(limit).all()
    return items


@app.post('/api/v1/product_locations', response_model=product_schemas.ProductLocation)
def suggest_product_location(payload: product_schemas.ProductLocationCreate = Body(...), db: Session = Depends(get_db)):
    # payload is validated by Pydantic
    pl = product_models.ProductLocation(**payload.dict())
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return pl


@app.get('/api/v1/product_locations')
@app.get('/api/v1/product_locations', response_model=list[product_schemas.ProductLocation])
def list_product_locations(product_identifier: str | None = None, db: Session = Depends(get_db)):
    q = db.query(product_models.ProductLocation)
    if product_identifier:
        q = q.filter(product_models.ProductLocation.product_identifier == product_identifier)
    items = q.order_by(product_models.ProductLocation.created_at.desc()).limit(200).all()
    return items


@app.get('/api/v1/products/lookup/{barcode}')
def lookup_product(barcode: str):
    """
    Lookup product info from Open Food Facts by barcode (EAN/GTIN).
    Returns product name, brand, categories, image, etc.
    """
    client = OpenFoodFactsClient()
    product = client.get_product(barcode)
    if not product:
        raise HTTPException(status_code=404, detail='Product not found in Open Food Facts')
    return {
        "barcode": barcode,
        "product_name": product.get("product_name") or product.get("product_name_de"),
        "brands": product.get("brands"),
        "categories": product.get("categories"),
        "image_url": product.get("image_url"),
        "nutriscore_grade": product.get("nutriscore_grade"),
        "ecoscore_grade": product.get("ecoscore_grade"),
    }


@app.post('/api/v1/donations', response_model=donation_schemas.Donation)
def create_donation(payload: donation_schemas.DonationCreate = Body(...), db: Session = Depends(get_db)):
    data = payload.dict()
    d = donation_models.Donation(**data)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@app.get('/api/v1/donations', response_model=list[donation_schemas.Donation])
def list_donations(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    items = db.query(donation_models.Donation).order_by(donation_models.Donation.created_at.desc()).offset(skip).limit(limit).all()
    return items


@app.post('/api/v1/product_locations/{id}/vote')
def vote_product_location(id: int, vote: dict = Body(...), db: Session = Depends(get_db), request: Request = None):
    # Simple API key protection for admin actions.
    admin_key = os.getenv('ADMIN_API_KEY')
    if admin_key:
        # Require header X-API-KEY
        header_key = request.headers.get('x-api-key') if request else None
        if header_key != admin_key:
            raise HTTPException(status_code=401, detail='Unauthorized')
    pl = db.query(product_models.ProductLocation).filter(product_models.ProductLocation.id == id).first()
    if not pl:
        raise HTTPException(status_code=404, detail='Not found')
    v = vote.get('vote')
    if v == 'up':
        pl.upvotes = pl.upvotes + 1
    elif v == 'down':
        pl.downvotes = pl.downvotes + 1
    else:
        raise HTTPException(status_code=400, detail='vote must be up or down')
    db.commit()
    return {"id": pl.id, "upvotes": pl.upvotes, "downvotes": pl.downvotes}


@app.post('/api/v1/product_locations/{id}/verify')
def verify_product_location(id: int, verifier: dict = Body(...), db: Session = Depends(get_db), request: Request = None):
    # API key check (header-only)
    admin_key = os.getenv('ADMIN_API_KEY')
    if admin_key:
        header_key = request.headers.get('x-api-key') if request else None
        if header_key != admin_key:
            raise HTTPException(status_code=401, detail='Unauthorized')
    pl = db.query(product_models.ProductLocation).filter(product_models.ProductLocation.id == id).first()
    if not pl:
        raise HTTPException(status_code=404, detail='Not found')
    pl.status = 'verified'
    pl.verified_by = verifier.get('verifier')
    pl.verified_at = datetime.datetime.utcnow()
    db.commit()
    return {"id": pl.id, "status": pl.status, "verified_by": pl.verified_by}

# Include OpenFoodFacts API routes
app.include_router(off_router)

# Include Ratings & Price Reports routes
app.include_router(rating_router)

# Include Store routes
from .store_routes import router as store_router
from . import store_models
store_models.Base = getattr(store_models, 'Base', None)
try:
    store_models.Base.metadata.create_all(bind=engine)
except Exception:
    pass
app.include_router(store_router)

# Include community routes (Overpass/OSM proxy)
from .community_routes import router as community_router
app.include_router(community_router)

# Create a ProductLocation from Open Food Facts product payload
@app.post('/api/v1/product_locations/from_off', response_model=product_schemas.ProductLocation)
def create_product_from_off(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Accepts OFF-like payload and persists a ProductLocation for the selected store.
    Expected fields: product_identifier (required), store_name (required), size_amount?, size_unit?, image_url?, aisle?, shelf_label?
    """
    product_identifier = payload.get('product_identifier')
    store_name = payload.get('store_name')
    if not product_identifier or not store_name:
        raise HTTPException(status_code=400, detail='product_identifier and store_name are required')

    existing = db.query(product_models.ProductLocation).filter(
        product_models.ProductLocation.product_identifier == product_identifier,
        product_models.ProductLocation.store_name == store_name
    ).first()
    if existing:
        return existing

    pl = product_models.ProductLocation(
        product_identifier=product_identifier,
        store_name=store_name,
        aisle=payload.get('aisle'),
        shelf_label=payload.get('shelf_label'),
        photo_url=payload.get('image_url') or payload.get('photo_url'),
        contributor=payload.get('contributor') or 'User Selection',
        status='suggested',
        upvotes=0,
        downvotes=0,
        size_amount=payload.get('size_amount'),
        size_unit=payload.get('size_unit'),
        current_price=payload.get('current_price'),
        price_currency=payload.get('price_currency') or 'EUR',
        price_history=payload.get('price_history'),
        created_at=datetime.datetime.utcnow()
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return pl

# User feedback on availability and optional metadata updates
@app.post('/api/v1/product_locations/{id}/feedback')
def product_location_feedback(id: int, feedback: dict = Body(...), db: Session = Depends(get_db)):
    """
    Feedback schema:
    { "found": true|false, "aisle"?: str, "shelf_label"?: str, "photo_url"?: str }
    If found = true increments upvote else increments downvote; also updates provided fields.
    """
    pl = db.query(product_models.ProductLocation).filter(product_models.ProductLocation.id == id).first()
    if not pl:
        raise HTTPException(status_code=404, detail='Not found')

    found = feedback.get('found')
    if found is True:
        pl.upvotes = (pl.upvotes or 0) + 1
    elif found is False:
        pl.downvotes = (pl.downvotes or 0) + 1

    # Optional updates
    if 'aisle' in feedback:
        pl.aisle = feedback.get('aisle')
    if 'shelf_label' in feedback:
        pl.shelf_label = feedback.get('shelf_label')
    if 'photo_url' in feedback:
        pl.photo_url = feedback.get('photo_url')

    db.commit()
    db.refresh(pl)
    return {"id": pl.id, "upvotes": pl.upvotes, "downvotes": pl.downvotes, "aisle": pl.aisle, "shelf_label": pl.shelf_label, "photo_url": pl.photo_url}
