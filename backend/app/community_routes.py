from fastapi import APIRouter
from typing import Optional, List
import time
import httpx
from asyncio import sleep

router = APIRouter()

VERIFY_SSL = False
REQUEST_TIMEOUT = 30.0


async def http_post_with_retry(url, data, timeout=60.0, retries=3):
    delay = 0.5
    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout, verify=VERIFY_SSL) as client:
                resp = await client.post(url, data=data)
                return resp
        except Exception as e:
            print(f'Overpass request attempt {attempt} failed: {e}')
            if attempt == retries:
                raise
            await sleep(delay)
            delay *= 2


def build_overpass_query(lat, lng, radius):
    return f"""
    [out:json][timeout:30];
    (
      node["shop"~"supermarket|convenience|greengrocer|organic|department_store|wholesale|beverages|bakery|butcher|cheese|deli|seafood|chocolate|confectionery|health_food|general|mall|kiosk|alcohol|farm|spices|tea|coffee|frozen_food|pasta|seafood|sweets|water|wine|zero_waste|food"](around:{radius},{lat},{lng});
      way["shop"~"supermarket|convenience|greengrocer|organic|department_store|wholesale|beverages|bakery|butcher|cheese|deli|seafood|chocolate|confectionery|health_food|general|mall|kiosk|alcohol|farm|spices|tea|coffee|frozen_food|pasta|seafood|sweets|water|wine|zero_waste|food"](around:{radius},{lat},{lng});
      relation["shop"~"supermarket|convenience|greengrocer|organic|department_store|wholesale|beverages|bakery|butcher|cheese|deli|seafood|chocolate|confectionery|health_food|general|mall|kiosk|alcohol|farm|spices|tea|coffee|frozen_food|pasta|seafood|sweets|water|wine|zero_waste|food"](around:{radius},{lat},{lng});
      node["amenity"="marketplace"](around:{radius},{lat},{lng});
      way["amenity"="marketplace"](around:{radius},{lat},{lng});
      relation["amenity"="marketplace"](around:{radius},{lat},{lng});
    );
    out center;
    """


@router.get('/api/v1/stores')
async def get_osm_stores(lat: Optional[float] = None, lng: Optional[float] = None, radius_km: Optional[float] = 10, limit: int = 200, q: Optional[str] = None):
    """Return stores from OpenStreetMap/Overpass. If lat/lng are missing, returns an empty list or limited demo data."""
    # If no coordinates provided and no query, return empty list (frontend will fallback to product_locations)
    if lat is None or lng is None:
        if not q:
            return []
        lat = 0.0
        lng = 0.0
    radius = int((radius_km or 10) * 1000)

    # Simple in-memory cache
    cache_key = f"{lat:.6f}:{lng:.6f}:{radius}:{q or ''}"
    if not hasattr(get_osm_stores, '_cache'):
        get_osm_stores._cache = {}
    cache = get_osm_stores._cache
    now = time.time()
    if cache_key in cache:
        ts, val = cache[cache_key]
        if now - ts < 60:
            return val[:limit]

    if q:
        q_esc = q.replace('"', '').replace('/', ' ')
        query = f"""
        [out:json][timeout:30];
        (
          node["name"~"{q_esc}",i](around:{radius},{lat},{lng});
          way["name"~"{q_esc}",i](around:{radius},{lat},{lng});
          relation["name"~"{q_esc}",i](around:{radius},{lat},{lng});
        );
        out center;
        """
    else:
        query = build_overpass_query(lat, lng, radius)

    url = "https://overpass-api.de/api/interpreter"
    try:
        resp = await http_post_with_retry(url, {"data": query}, timeout=60.0, retries=3)
        data = resp.json()
        elements = data.get('elements', [])
        results = []
        for el in elements:
            tags = el.get('tags', {})
            name = tags.get('name')
            if not name:
                continue
            osm_type = el.get('type') or 'node'
            osm_id = el.get('id')
            lat_c = None
            lon_c = None
            if el.get('lat') is not None and el.get('lon') is not None:
                lat_c = el.get('lat')
                lon_c = el.get('lon')
            elif el.get('center'):
                lat_c = el.get('center').get('lat')
                lon_c = el.get('center').get('lon')
            osm_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
            edit_url = f"https://www.openstreetmap.org/edit?editor=id&{osm_type}={osm_id}"
            results.append({
                "full_name": name,
                "chain": tags.get('brand') or tags.get('operator') or tags.get('shop') or "",
                "location": f"{tags.get('addr:city','')}, {tags.get('addr:street','')} {tags.get('addr:housenumber','')}",
                "lat": lat_c,
                "lng": lon_c,
                "osm_id": osm_id,
                "osm_type": osm_type,
                "osm_url": osm_url,
                "edit_url": edit_url,
                "shop": tags.get('shop'),
                "brand": tags.get('brand'),
                "operator": tags.get('operator'),
                "tags": tags,
            })
            if len(results) >= limit:
                break
        cache[cache_key] = (now, results)
        return results
    except Exception as e:
        print('Overpass API error:', e)
        return []
