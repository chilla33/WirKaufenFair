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
import asyncio
from .ethics_db import get_ethics_score, extract_brand_from_product, get_ethics_issues_summary

router = APIRouter(prefix="/api/v1/openfoodfacts", tags=["OpenFoodFacts"])


# Simple in-memory TTL cache
class TTLCache:
    def __init__(self, ttl_minutes: int = 20):
        self.cache = {}
        self.ttl = timedelta(minutes=ttl_minutes)

    def _make_key(self, *args, **kwargs) -> str:
        key_data = json.dumps([args, sorted(kwargs.items())], sort_keys=True)
        return hashlib.md5(key_data.encode()).hexdigest()

    def get(self, *args, **kwargs) -> Optional[Any]:
        key = self._make_key(*args, **kwargs)
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.now() - timestamp < self.ttl:
                return value
            else:
                del self.cache[key]
        return None

    def set(self, value: Any, *args, **kwargs):
        key = self._make_key(*args, **kwargs)
        self.cache[key] = (value, datetime.now())

    def clear_expired(self):
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

# SSL verification disabled for some Windows environments
VERIFY_SSL = False

# Extended timeout for slow OFF API
REQUEST_TIMEOUT = 30.0


async def http_get_with_retry(url, params=None, timeout=REQUEST_TIMEOUT, retries=3, verify=VERIFY_SSL):
    """Simple async GET with exponential backoff retries."""
    delay = 0.5
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(verify=verify, timeout=timeout) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                return resp
        except Exception as e:
            last_exc = e
            print(f'HTTP GET attempt {attempt} to {url} failed: {e}')
            if attempt == retries:
                break
            await asyncio.sleep(delay)
            delay *= 2
    raise last_exc


def extract_size_from_quantity(quantity: str) -> tuple[Optional[float], Optional[str]]:
    if not quantity:
        return None, None
    s = str(quantity).lower().replace('\u00a0', ' ')
    # handle multiplicative patterns like '2x250g', '6 x 330 ml', '4er pack 250 g'
    mult_match = re.search(r'(\d+)\s*(?:x|×|er|pack|stk|st)\s*([\d.,]+)\s*(g|kg|ml|l)?', s)
    if mult_match:
        count = int(mult_match.group(1))
        amt = float(mult_match.group(2).replace(',', '.'))
        unit = (mult_match.group(3) or 'g').lower()
        total = count * amt
        if unit == 'kg':
            total *= 1000
            unit = 'g'
        if unit == 'l':
            total *= 1000
            unit = 'ml'
        return total, unit
    # fallback: single quantity like '250 g' or '1.5 l'
    match = re.search(r'([\d.,]+)\s*(g|kg|ml|l|cl|dl)', s)
    if not match:
        return None, None
    amount = float(match.group(1).replace(',', '.'))
    unit = match.group(2).lower()
    if unit == 'kg':
        amount *= 1000
        unit = 'g'
    if unit == 'l':
        amount *= 1000
        unit = 'ml'
    if unit == 'cl':
        amount *= 10
        unit = 'ml'
    if unit == 'dl':
        amount *= 100
        unit = 'ml'
    return amount, unit


def transform_off_product(product: Dict[str, Any]) -> Dict[str, Any]:
    barcode = product.get('code', '')
    name_de = product.get('product_name_de') or product.get('product_name') or ''
    brand = product.get('brands', '').split(',')[0].strip() if product.get('brands') else ''
    quantity = product.get('quantity', '') or ''
    image_url = (
        product.get('image_url') or
        product.get('image_front_url') or
        product.get('image_front_small_url') or
        product.get('image_small_url') or
        (product.get('selected_images') or {}).get('front', {}).get('display', {}).get('de') or
        (product.get('selected_images') or {}).get('front', {}).get('display', {}).get('en')
    )
    product_id = f"{brand} {name_de}".strip() if brand else name_de
    if quantity:
        product_id = f"{product_id} {quantity}".strip()
    size_amount, size_unit = extract_size_from_quantity(quantity)
    nutriscore = (product.get('nutriscore_grade') or product.get('nutriscore') or '').upper()
    ecoscore = (product.get('ecoscore_grade') or product.get('ecoscore') or '').upper()
    brand_for_ethics = brand if brand else extract_brand_from_product(product_id)
    ethics_score = get_ethics_score(brand_for_ethics) if brand_for_ethics else 0.6
    ethics_issues = get_ethics_issues_summary(brand_for_ethics) if brand_for_ethics else []
    stores = product.get('stores', '') or product.get('stores_tags', [])
    if isinstance(stores, list):
        stores = ', '.join(stores)
    categories = product.get('categories_tags') or []
    categories_text = product.get('categories') or ''
    ingredients_text = product.get('ingredients_text_de') or product.get('ingredients_text') or ''
    allergens = product.get('allergens_tags') or []
    labels = product.get('labels_tags') or []
    manufacturing_places = product.get('manufacturing_places') or ''
    origins = product.get('origins') or ''
    # Estimate price per package if possible and compute unit price (€/kg or €/L)
    est_price = estimate_price(product)
    unit_price = None
    if est_price and size_amount and size_unit:
        # compute €/kg or €/L
        if size_unit in ('g', 'kg'):
            kg = size_amount / 1000.0
            if kg > 0:
                unit_price = { 'value': round(est_price / kg, 2), 'unit': 'kg', 'display': f"{round(est_price / kg,2):.2f} €/kg" }
        elif size_unit in ('ml', 'l'):
            l = size_amount / 1000.0
            if l > 0:
                unit_price = { 'value': round(est_price / l, 2), 'unit': 'l', 'display': f"{round(est_price / l,2):.2f} €/L" }

    return {
        "barcode": barcode,
        "product_identifier": product_id,
        "product_name": name_de,
        "product_name_orig": product.get('product_name') or product.get('product_name_en') or None,
        "brand": brand,
        "quantity": quantity,
        "size_amount": size_amount,
        "size_unit": size_unit,
        "image_url": image_url,
        "image_small_url": product.get('image_small_url') or product.get('image_front_small_url') or None,
        "image_front_small_url": product.get('image_front_small_url') or None,
        "nutriscore": nutriscore if nutriscore else None,
        "ecoscore": ecoscore if ecoscore else None,
        "ethics_score": ethics_score,
        "ethics_issues": ethics_issues,
        "categories": categories,
        "categories_text": categories_text,
        "stores": stores,
        "source": "openfoodfacts",
        "price": None,
        "price_currency": "EUR",
        "ingredients": ingredients_text,
        "allergens": allergens,
        "labels": labels,
        "manufacturing_places": manufacturing_places,
        "origins": origins
        ,
        "estimated_price": est_price,
        "unit_price": unit_price
    }


GRADE_SCORE = { 'A': 1.0, 'B': 0.8, 'C': 0.6, 'D': 0.4, 'E': 0.2 }


def compute_fair_score_for_product(p: Dict[str, Any]) -> float:
    """Compute the fair score server-side using same weights as frontend.
    eco: 50%, ethics: 30%, nutri: 10% (verified/local boosts not applied server-side).
    """
    eco_grade = (p.get('ecoscore') or p.get('ecoscore_grade') or '')
    nutri_grade = (p.get('nutriscore') or p.get('nutriscore_grade') or '')
    eco = GRADE_SCORE.get(str(eco_grade).upper(), 0)
    nutri = GRADE_SCORE.get(str(nutri_grade).upper(), 0)
    ethics = float(p.get('ethics_score') if isinstance(p.get('ethics_score'), (int, float)) else (p.get('ethics_score') or 0.6))
    # Small presence boost for having an ecoscore (makes any product with an ecoscore rank clearly higher)
    presence_boost = 0.08 if (p.get('ecoscore') or p.get('ecoscore_grade')) else 0
    total = (eco * 0.5) + (ethics * 0.3) + (nutri * 0.1) + presence_boost
    return round(total, 4)


@router.get("/search")
async def search_products(
    query: str = Query(..., description="Search term (e.g., 'Joghurt', 'Milch')"),
    country: str = Query("de", description="Country code"),
    page: int = Query(1, description="Page number"),
    page_size: int = Query(20, description="Results per page")
) -> Dict[str, Any]:
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
        try:
            response = await http_get_with_retry(OFF_SEARCH, params=params, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
            data = response.json()
        except Exception as e:
            print(f"⚠️ OFF v2 API request failed, trying v0 fallback: {e}")
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
            response = await http_get_with_retry(OFF_SEARCH_V0, params=v0_params, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
            data = response.json()

        products = data.get('products', [])
        if not products:
            print(f"OFF search returned 0 products for query='{query}' country='{country}' page={page} page_size={page_size} status={getattr(response,'status_code',None)}")
            try:
                print('OFF response snippet:', response.text[:1000])
            except Exception:
                pass

        transformed = [transform_off_product(p) for p in products]
        # compute server-side fair score and sort so faireste Produkte come first
        for t in transformed:
            try:
                t['__fairScore'] = compute_fair_score_for_product(t)
            except Exception:
                t['__fairScore'] = 0
        transformed.sort(key=lambda x: x.get('__fairScore', 0), reverse=True)

        # Enrich top results (best-effort)
        try:
            to_enrich = []
            idx_map = {}
            for i, t in enumerate(transformed[:12]):
                missing = False
                if not t.get('size_amount') or not t.get('size_unit'):
                    missing = True
                if not t.get('nutriscore') and not t.get('nutriscore_grade'):
                    missing = True
                if not t.get('ecoscore') and not t.get('ecoscore_grade'):
                    missing = True
                code = products[i].get('code')
                if missing and code:
                    to_enrich.append(code)
                    idx_map[code] = i
            if to_enrich:
                tasks = [http_get_with_retry(f"{OFF_PRODUCT}/{code}.json", timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL) for code in to_enrich]
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                for code, resp in zip(to_enrich, responses):
                    if isinstance(resp, Exception):
                        continue
                    try:
                        full = resp.json().get('product')
                        if not full:
                            continue
                        enriched = transform_off_product(full)
                        idx = idx_map.get(code)
                        if idx is None:
                            continue
                        base = transformed[idx]
                        for k in ['quantity','size_amount','size_unit','nutriscore','nutriscore_grade','ecoscore','ecoscore_grade','image_url','ethics_score','ethics_issues']:
                            if (not base.get(k)) and enriched.get(k) is not None:
                                base[k] = enriched[k]
                        transformed[idx] = base
                    except Exception:
                        continue
        except Exception:
            pass

        result = {
            "count": data.get('count', 0),
            "page": data.get('page', page),
            "page_size": data.get('page_size', page_size),
            "products": transformed
        }
        search_cache.set(result, query, country, page, page_size)
        return result
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from Open Food Facts: {str(e)}")


@router.get("/product/{barcode}")
async def get_product_by_barcode(barcode: str) -> Dict[str, Any]:
    cached = product_cache.get(barcode)
    if cached is not None:
        return cached
    url = f"{OFF_PRODUCT}/{barcode}.json"
    try:
        response = await http_get_with_retry(url, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
        data = response.json()
        if data.get('status') != 1:
            raise HTTPException(status_code=404, detail="Product not found")
        product = data.get('product', {})
        result = transform_off_product(product)
        product_cache.set(result, barcode)
        return result
    except Exception as e:
        print('OFF product proxy error:', repr(e))
        raise HTTPException(status_code=500, detail=f"Error fetching from Open Food Facts: {str(e)}")


@router.get("/autocomplete")
async def autocomplete_products(
    query: str = Query(..., min_length=2, description="Search term (min 2 chars)"),
    limit: int = Query(10, description="Max results")
) -> List[Dict[str, Any]]:
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
        response = await http_get_with_retry(OFF_SEARCH, params=params, timeout=5.0, retries=2, verify=VERIFY_SSL)
        data = response.json()
        products = data.get('products', [])
        results = []
        for p in products:
            name = p.get('product_name_de') or p.get('product_name') or ''
            brand = p.get('brands', '').split(',')[0].strip()
            display = f"{brand} {name}".strip() if brand else name
            image_url = p.get('image_url') or p.get('image_front_url') or p.get('image_front_small_url') or p.get('image_small_url')
            results.append({
                "barcode": p.get('code'),
                "display": display,
                "image_url": image_url
            })
        autocomplete_cache.set(results, query, limit)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from Open Food Facts: {str(e)}")


@router.post("/cache/clear")
async def clear_cache() -> Dict[str, str]:
    search_cache.clear_expired()
    product_cache.clear_expired()
    autocomplete_cache.clear_expired()
    search_cache.cache.clear()
    product_cache.cache.clear()
    autocomplete_cache.cache.clear()
    return {"status": "success", "message": "All OFF proxy caches cleared"}


@router.get("/cache/stats")
async def cache_stats() -> Dict[str, Any]:
    return {
        "search_cache": {"entries": len(search_cache.cache), "ttl_minutes": 20},
        "product_cache": {"entries": len(product_cache.cache), "ttl_minutes": 30},
        "autocomplete_cache": {"entries": len(autocomplete_cache.cache), "ttl_minutes": 15}
    }
"""
Open Food Facts API proxy endpoints
Provides live product data without storing in local DB
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import httpx
    try:
        # Try v2 API first with retries
        try:
            response = await http_get_with_retry(OFF_SEARCH, params=params, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
            data = response.json()
        except Exception as e:
            # Fallback to v0 API
            print(f"⚠️ OFF v2 API request failed, trying v0 fallback: {e}")
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
            response = await http_get_with_retry(OFF_SEARCH_V0, params=v0_params, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
            data = response.json()

        # Transform products
        products = data.get('products', [])
        if not products:
            try:
                print(f"OFF search returned 0 products for query='{query}' country='{country}' page={page} page_size={page_size} status={getattr(response,'status_code',None)}")
                # print a short snippet of response for debugging
                try:
                    print('OFF response snippet:', response.text[:1000])
                except Exception:
                    pass
            except Exception:
                pass
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

# NOTE: HTTP helper and timeout/VERIFY_SSL are defined at top of this module.


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
        "product_name_orig": product.get('product_name') or product.get('product_name_en') or None,
        "brand": brand,
        "quantity": quantity,
        "size_amount": size_amount,
        "size_unit": size_unit,
        "image_url": image_url,
        "image_small_url": product.get('image_small_url') or product.get('image_front_small_url') or None,
        "image_front_small_url": product.get('image_front_small_url') or None,
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
        # Try v2 API first with retries
        try:
            response = await http_get_with_retry(OFF_SEARCH, params=params, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
            data = response.json()
        except Exception as e:
            # Fallback to v0 API
            print(f"⚠️ OFF v2 API request failed, trying v0 fallback: {e}")
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
            response = await http_get_with_retry(OFF_SEARCH_V0, params=v0_params, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
            data = response.json()

        # Transform products
        products = data.get('products', [])
        transformed = [transform_off_product(p) for p in products]

        # Enrich top results that miss important info (quantity, nutri/ecoscore) by fetching full product details
        # Limit enrichment to first N candidates to avoid heavy load
        try:
            to_enrich = []
            idx_map = {}
            for i, t in enumerate(transformed[:12]):
                missing = False
                if not t.get('size_amount') or not t.get('size_unit'):
                    missing = True
                if not t.get('nutriscore') and not t.get('nutriscore_grade'):
                    missing = True
                if not t.get('ecoscore') and not t.get('ecoscore_grade'):
                    missing = True
                code = products[i].get('code')
                if missing and code:
                    to_enrich.append(code)
                    idx_map[code] = i

            if to_enrich:
                tasks = [http_get_with_retry(f"{OFF_PRODUCT}/{code}.json", timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL) for code in to_enrich]
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                for code, resp in zip(to_enrich, responses):
                    if isinstance(resp, Exception):
                        continue
                    try:
                        full = resp.json().get('product')
                        if not full:
                            continue
                        enriched = transform_off_product(full)
                        idx = idx_map.get(code)
                        if idx is None:
                            continue
                        base = transformed[idx]
                        # copy missing fields from enriched
                        for k in ['quantity','size_amount','size_unit','nutriscore','nutriscore_grade','ecoscore','ecoscore_grade','image_url','ethics_score','ethics_issues']:
                            if (not base.get(k)) and enriched.get(k) is not None:
                                base[k] = enriched[k]
                        transformed[idx] = base
                    except Exception:
                        continue
        except Exception:
            # enrichment is best-effort; don't fail the whole request
            pass
            
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
        response = await http_get_with_retry(url, timeout=REQUEST_TIMEOUT, retries=2, verify=VERIFY_SSL)
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
        response = await http_get_with_retry(OFF_SEARCH, params=params, timeout=5.0, retries=2, verify=VERIFY_SSL)
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
