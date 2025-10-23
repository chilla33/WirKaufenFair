
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
import os
import httpx
from typing import Optional
import math
import time
import urllib.parse

app = FastAPI()

# Hilfsfunktion: Overpass-Query für Supermärkte/Läden
def build_overpass_query(lat, lng, radius):
	# Suche nach Supermarkt, Discounter, Lebensmittel, Drogerie
	# Include nodes, ways and relations and request center for ways/relations so we get coordinates
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

# API-Endpunkt: Läden aus OSM/Overpass
@app.get("/api/v1/stores")
async def get_osm_stores(lat: Optional[float] = None, lng: Optional[float] = None, radius_km: Optional[float] = 10, limit: int = 200):
	if lat is None or lng is None:
		# Fallback: Beispiel-Läden
		return stores_data[:limit]
	radius = int((radius_km or 10) * 1000)
	# Simple in-memory cache to reduce Overpass load (valid for 60s)
	cache_key = f"{lat:.6f}:{lng:.6f}:{radius}"
	if not hasattr(get_osm_stores, '_cache'):
		get_osm_stores._cache = {}
	cache = get_osm_stores._cache
	now = time.time()
	if cache_key in cache:
		ts, val = cache[cache_key]
		if now - ts < 60:
			return val[:limit]
	query = build_overpass_query(lat, lng, radius)
	url = "https://overpass-api.de/api/interpreter"
	try:
		async with httpx.AsyncClient(timeout=30) as client:
			resp = await client.post(url, data={"data": query})
			data = resp.json()
		elements = data.get("elements", [])
		# Umwandeln in gewünschtes Format
		results = []
		for el in elements:
			tags = el.get("tags", {})
			name = tags.get("name")
			if not name:
				continue
			osm_type = el.get('type') or 'node'
			osm_id = el.get('id')
			# Determine coordinates: nodes have lat/lon, ways/relations return 'center'
			lat = None
			lon = None
			if el.get('lat') is not None and el.get('lon') is not None:
				lat = el.get('lat')
				lon = el.get('lon')
			elif el.get('center'):
				lat = el.get('center').get('lat')
				lon = el.get('center').get('lon')
			osm_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
			edit_url = f"https://www.openstreetmap.org/edit?editor=id&{osm_type}={osm_id}"
			results.append({
				"full_name": name,
				"chain": tags.get("brand") or tags.get("operator") or tags.get("shop") or "?",
				"location": f"{tags.get('addr:city','')}, {tags.get('addr:street','')} {tags.get('addr:housenumber','')}",
				"lat": lat,
				"lng": lon,
				"osm_id": osm_id,
				"osm_type": osm_type,
				"osm_url": osm_url,
				"edit_url": edit_url,
				"shop": tags.get("shop"),
				"brand": tags.get("brand"),
				"operator": tags.get("operator"),
				"tags": tags,
			})
			if len(results) >= limit:
				break
		# store in cache
		cache[cache_key] = (now, results)
		return results
		return results
	except Exception as e:
		print("Overpass-API-Fehler:", e)
		return []


# OpenFoodFacts search proxy (simple)
@app.get('/api/v1/openfoodfacts/search')
async def off_search(query: Optional[str] = None, page_size: int = 8):
	if not query:
		return {"products": []}
	url = 'https://world.openfoodfacts.org/cgi/search.pl'
	params = {
		'search_terms': query,
		'page_size': page_size,
		'json': 1,
		'action': 'process'
	}
	try:
		async with httpx.AsyncClient(timeout=20) as client:
			resp = await client.get(url, params=params)
			if resp.status_code != 200:
				return {"products": []}
			data = resp.json()
		products = data.get('products', [])
		out = []
		for p in products:
			out.append({
				'product_name': p.get('product_name') or p.get('generic_name'),
				'image_small_url': p.get('image_small_url') or p.get('image_front_small_url'),
				'code': p.get('code'),
				'labels': p.get('labels', ''),
				'labels_tags': p.get('labels_tags', [])
			})
		return {"products": out}
	except Exception as e:
		print('OFF proxy error:', e)
		return {"products": []}


@app.get('/api/v1/openfoodfacts/product/{barcode}')
async def off_product(barcode: str):
	if not barcode:
		return {"product": None}
	url = f'https://world.openfoodfacts.org/api/v0/product/{urllib.parse.quote(barcode)}.json'
	try:
		async with httpx.AsyncClient(timeout=20) as client:
			resp = await client.get(url)
			if resp.status_code != 200:
				return {"product": None}
			data = resp.json()
		return {"product": data.get('product')}
	except Exception as e:
		print('OFF product proxy error:', e)
		return {"product": None}


# Root-Route für Weiterleitung auf die Startseite
@app.get("/")
def root(request: Request):
	return RedirectResponse(url="/static/shopping_list.html")

# Statische Dateien bereitstellen (z.B. für /static)
static_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Assets-Ordner bereitstellen (z.B. für /assets)
assets_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'assets')
app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

# Beispielroute für Testzwecke
@app.get("/api/v1/hello")
def hello():
	return {"message": "Hello from FastAPI!"}

# Beispiel-Daten für Stores und ProductLocations
stores_data = [
	{"full_name": "REWE Musterstadt", "chain": "REWE", "location": "Musterstadt"},
	{"full_name": "EDEKA Beispielhausen", "chain": "EDEKA", "location": "Beispielhausen"}
]

product_locations_data = [
	{"store_name": "REWE Musterstadt", "product": "Milch", "aisle": "1", "shelf_label": "Kühlregal"},
	{"store_name": "EDEKA Beispielhausen", "product": "Brot", "aisle": "2", "shelf_label": "Backwaren"}
]

# API-Endpunkt für ProductLocations
@app.get("/api/v1/product_locations")
def get_product_locations():
	return product_locations_data

# Beispielcode
community_data = []