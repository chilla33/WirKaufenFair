"""
Open Food Facts API proxy endpoints
Provides live product data without storing in local DB
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import httpx
import re
from functools import lru_cache
from datetime import datetime, timedelta
import hashlib
import json
from .ethics_db import get_ethics_score, extract_brand_from_product, get_ethics_issues_summary

router = APIRouter(prefix="/api/v1/openfoodfacts", tags=["OpenFoodFacts"])

# Simple in-memory TTL cache
class TTLCache:
    def __init__(self, ttl_minutes: int = 20):
        self.cache = {}
        self.ttl = timedelta(minutes=ttl_minutes)
    
    def _make_key(self, *args, **kwargs) -> str:
        """Create cache key from arguments"""
        key_data = json.dumps([args, sorted(kwargs.items())], sort_keys=True)
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, *args, **kwargs) -> Optional[Any]:
        """Get cached value if not expired"""
        key = self._make_key(*args, **kwargs)
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.now() - timestamp < self.ttl:
                return value
            else:
                del self.cache[key]
        return None
    
    def set(self, value: Any, *args, **kwargs):
        """Set value with current timestamp"""
        key = self._make_key(*args, **kwargs)
        self.cache[key] = (value, datetime.now())
    
    def clear_expired(self):
        """Clear all expired entries"""
        now = datetime.now()
        expired = [k for k, (_, ts) in self.cache.items() if now - ts >= self.ttl]
        for k in expired:
            del self.cache[k]

# Create cache instances with 20-minute TTL
search_cache = TTLCache(ttl_minutes=20)
product_cache = TTLCache(ttl_minutes=30)  # Products change less frequently
autocomplete_cache = TTLCache(ttl_minutes=15)  # Shorter for autocomplete

OFF_API_BASE = "https://world.openfoodfacts.org/api/v2"
OFF_SEARCH = f"{OFF_API_BASE}/search"
OFF_SEARCH_V0 = "https://world.openfoodfacts.org/cgi/search.pl"  # Fallback to v0 API
OFF_PRODUCT = "https://world.openfoodfacts.org/api/v0/product"

# SSL verification disabled for Windows environment
VERIFY_SSL = False

# Extended timeout for slow OFF API
REQUEST_TIMEOUT = 30.0

def extract_size_from_quantity(quantity: str) -> tuple[Optional[float], Optional[str]]:
    """Extract size amount and unit from quantity string like '150 g' or '1 L'"""
    if not quantity:
        return None, None
    
    # Match patterns like "150 g", "1.5 L", "500ml"
    match = re.search(r'([\d.,]+)\s*(g|kg|ml|l|cl|dl)', quantity.lower())
    if not match:
        return None, None
    
    amount = float(match.group(1).replace(',', '.'))
    unit = match.group(2).lower()
    
    # Normalize units
    if unit == 'kg':
        amount *= 1000
        unit = 'g'
    elif unit == 'l':
        amount *= 1000
        unit = 'ml'
    elif unit == 'cl':
        amount *= 10
        unit = 'ml'
    elif unit == 'dl':
        amount *= 100
        unit = 'ml'
    
    return amount, unit

def estimate_price(product: Dict[str, Any]) -> Optional[float]:
    """Estimate price based on product category and size (very rough heuristic). Returns total package price in EUR."""
    categories = product.get('categories_tags', []) or []
    quantity = product.get('quantity', '') or ''

    size_amount, size_unit = extract_size_from_quantity(quantity)

    # EUR per 100g/ml fallback map
    price_per_100 = [
        (('dairy', 'yaourts', 'fromages'), 0.50),
        (('beverages', 'drinks'), 0.15),
        (('bread', 'breads'), 0.40),
        (('fruits',), 0.30),
        (('vegetables',), 0.25),
        (('snacks',), 0.80),
        (('spreads',), 1.00),
    ]

    base = 0.50
    lcats = [c.lower() for c in categories]
    for keys, p in price_per_100:
        if any(k in lcats for k in keys):
            base = p
            break

    if size_amount and size_unit in ('g', 'ml'):
        return round((size_amount / 100.0) * base, 2)
    return None

def transform_off_product(product: Dict[str, Any]) -> Dict[str, Any]:
    """Transform OFF product data to our format"""
    barcode = product.get('code', '')
    name_de = product.get('product_name_de') or product.get('product_name', '')
    brand = product.get('brands', '').split(',')[0].strip() if product.get('brands') else ''
    quantity = product.get('quantity', '')
    
    # Try multiple image fields in order of preference
    image_url = (
        product.get('image_url') or 
        product.get('image_front_url') or 
        product.get('image_front_small_url') or 
        product.get('image_small_url') or
        product.get('selected_images', {}).get('front', {}).get('display', {}).get('de') or
        product.get('selected_images', {}).get('front', {}).get('display', {}).get('en')
    )
    
    # Build product identifier
    product_id = f"{brand} {name_de}".strip() if brand else name_de
    if quantity:
        product_id += f" {quantity}"
    
    # Extract size
    size_amount, size_unit = extract_size_from_quantity(quantity)
    
    # Get nutrition data
    nutriscore = product.get('nutriscore_grade', '').upper()
    ecoscore = product.get('ecoscore_grade', '').upper()
    
    # Get ethics score
    brand_for_ethics = brand if brand else extract_brand_from_product(product_id)
    ethics_score = get_ethics_score(brand_for_ethics) if brand_for_ethics else 0.6
    ethics_issues = get_ethics_issues_summary(brand_for_ethics) if brand_for_ethics else []
    
    # Get stores where product is sold (OFF data!)
    stores = product.get('stores', '') or product.get('stores_tags', [])
    if isinstance(stores, list):
        stores = ', '.join(stores)
    
    # Get categories for better matching
    categories = product.get('categories_tags', []) or []
    categories_text = product.get('categories', '')
    
    # Get additional useful fields from OFF
    ingredients_text = product.get('ingredients_text_de') or product.get('ingredients_text', '')
    allergens = product.get('allergens_tags', []) or []
    labels = product.get('labels_tags', []) or []  # e.g., 'en:organic', 'en:fair-trade'
    manufacturing_places = product.get('manufacturing_places', '')
    origins = product.get('origins', '')

    return {
        "barcode": barcode,
        "product_identifier": product_id,
        "product_name": name_de,
        "brand": brand,
        "quantity": quantity,
        "size_amount": size_amount,
        "size_unit": size_unit,
        "image_url": image_url,
        "nutriscore": nutriscore if nutriscore else None,
        "ecoscore": ecoscore if ecoscore else None,
        "ethics_score": ethics_score,
        "ethics_issues": ethics_issues,
        "categories": categories,
        "categories_text": categories_text,
        "stores": stores,  # ← OFF hat manchmal Laden-Infos!
        "source": "openfoodfacts",
        "price": None,  # ← Muss in unserer DB gepflegt werden!
        "price_currency": "EUR",
        # Zusätzliche OFF-Daten für bessere Produktinfo:
        "ingredients": ingredients_text,
        "allergens": allergens,
        "labels": labels,  # Bio, Fairtrade, etc.
        "manufacturing_places": manufacturing_places,
        "origins": origins
    }

@router.get("/search")
async def search_products(
    query: str = Query(..., description="Search term (e.g., 'Joghurt', 'Milch')"),
    country: str = Query("de", description="Country code"),
    page: int = Query(1, description="Page number"),
    page_size: int = Query(20, description="Results per page")
) -> Dict[str, Any]:
    """
    Search products on Open Food Facts
    Returns live data from OFF API with 20-minute cache
    """
    # Check cache first
    cached = search_cache.get(query, country, page, page_size)
    if cached is not None:
        return cached
    
    params = {
        "search_terms": query,
        "countries_tags": country,
        "page": page,
        "page_size": page_size,
        "fields": "code,product_name,product_name_de,brands,quantity,image_url,image_front_url,image_front_small_url,image_small_url,stores,stores_tags,categories,categories_tags,nutriscore_grade,ecoscore_grade,ingredients_text,ingredients_text_de,allergens_tags,labels_tags,manufacturing_places,origins"
    }
    
    try:
        async with httpx.AsyncClient(verify=VERIFY_SSL, timeout=REQUEST_TIMEOUT) as client:
            # Try v2 API first
            try:
                response = await client.get(OFF_SEARCH, params=params)
                response.raise_for_status()
                data = response.json()
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                # Fallback to v0 API
                print(f"⚠️ OFF v2 API timeout, trying v0 fallback: {e}")
                v0_params = {
                    "search_terms": query,
                    "tagtype_0": "countries",
                    "tag_contains_0": "contains",
                    "tag_0": country,
                    "page": page,
                    "page_size": page_size,
                    "json": 1,
                    "fields": "code,product_name,product_name_de,brands,quantity,image_url,image_front_url,stores,categories_tags,nutriscore_grade,ecoscore_grade"
                }
                response = await client.get(OFF_SEARCH_V0, params=v0_params)
                response.raise_for_status()
                data = response.json()
            
            # Transform products
            products = data.get('products', [])
            transformed = [transform_off_product(p) for p in products]
            
            result = {
                "count": data.get('count', 0),
                "page": data.get('page', page),
                "page_size": data.get('page_size', page_size),
                "products": transformed
            }
            
            # Cache the result
            search_cache.set(result, query, country, page, page_size)
            
            return result
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from Open Food Facts: {str(e)}")

@router.get("/product/{barcode}")
async def get_product_by_barcode(barcode: str) -> Dict[str, Any]:
    """
    Get product details by barcode from Open Food Facts
    Returns live data from OFF API with 30-minute cache
    """
    # Check cache first
    cached = product_cache.get(barcode)
    if cached is not None:
        return cached
    
    url = f"{OFF_PRODUCT}/{barcode}.json"
    
    try:
        async with httpx.AsyncClient(verify=VERIFY_SSL, timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            if data.get('status') != 1:
                raise HTTPException(status_code=404, detail="Product not found")
            
            product = data.get('product', {})
            result = transform_off_product(product)
            
            # Cache the result
            product_cache.set(result, barcode)
            
            return result
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from Open Food Facts: {str(e)}")

@router.get("/autocomplete")
async def autocomplete_products(
    query: str = Query(..., min_length=2, description="Search term (min 2 chars)"),
    limit: int = Query(10, description="Max results")
) -> List[Dict[str, Any]]:
    """
    Fast autocomplete for product search
    Returns simplified product list for autocomplete dropdown with 15-minute cache
    """
    # Check cache first
    cached = autocomplete_cache.get(query, limit)
    if cached is not None:
        return cached
    
    params = {
        "search_terms": query,
        "countries_tags": "de",
        "page": 1,
        "page_size": limit,
        "fields": "code,product_name,product_name_de,brands,quantity,image_url,image_front_url,image_front_small_url,image_small_url"
    }
    
    try:
        async with httpx.AsyncClient(verify=VERIFY_SSL, timeout=5.0) as client:
            response = await client.get(OFF_SEARCH, params=params)
            response.raise_for_status()
            data = response.json()
            
            products = data.get('products', [])
            results = []
            
            for p in products:
                name = p.get('product_name_de') or p.get('product_name', '')
                brand = p.get('brands', '').split(',')[0].strip()
                display = f"{brand} {name}".strip() if brand else name
                
                # Try multiple image fields
                image_url = (
                    p.get('image_url') or 
                    p.get('image_front_url') or 
                    p.get('image_front_small_url') or 
                    p.get('image_small_url')
                )
                
                results.append({
                    "barcode": p.get('code'),
                    "display": display,
                    "image_url": image_url
                })
            
            # Cache the results
            autocomplete_cache.set(results, query, limit)
            
            return results
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from Open Food Facts: {str(e)}")

@router.post("/cache/clear")
async def clear_cache() -> Dict[str, str]:
    """
    Clear all OFF proxy caches (admin endpoint)
    Useful for forcing fresh data or debugging
    """
    search_cache.clear_expired()
    product_cache.clear_expired()
    autocomplete_cache.clear_expired()
    
    # Also clear all entries
    search_cache.cache.clear()
    product_cache.cache.clear()
    autocomplete_cache.cache.clear()
    
    return {"status": "success", "message": "All OFF proxy caches cleared"}

@router.get("/cache/stats")
async def cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics
    Shows current cache sizes and helps monitor performance
    """
    return {
        "search_cache": {
            "entries": len(search_cache.cache),
            "ttl_minutes": 20
        },
        "product_cache": {
            "entries": len(product_cache.cache),
            "ttl_minutes": 30
        },
        "autocomplete_cache": {
            "entries": len(autocomplete_cache.cache),
            "ttl_minutes": 15
        }
    }
