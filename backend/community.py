
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os
import httpx
from typing import Optional
import math
import time
import urllib.parse
from asyncio import sleep

app = FastAPI()

# Global HTTP helpers for external APIs
VERIFY_SSL = False
REQUEST_TIMEOUT = 30.0

async def http_get_with_retry(url, params=None, timeout=REQUEST_TIMEOUT, retries=3, verify=VERIFY_SSL):
	"""Simple async GET with exponential backoff retries."""
	delay = 0.5
	last_exc = None
	for attempt in range(1, retries + 1):
		try:
			async with httpx.AsyncClient(timeout=timeout, verify=verify) as client:
				resp = await client.get(url, params=params)
				return resp
		except Exception as e:
			last_exc = e
			print(f'HTTP GET attempt {attempt} to {url} failed: {e}')
			if attempt == retries:
				break
			await sleep(delay)
			delay *= 2
	raise last_exc

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
async def get_osm_stores(lat: Optional[float] = None, lng: Optional[float] = None, radius_km: Optional[float] = 10, limit: int = 200, q: Optional[str] = None):
	# If no coordinates provided and no query, return demo stores
	if lat is None or lng is None:
		if not q:
			return stores_data[:limit]
		# If query provided but no coords, expand search radius globally (not ideal)
		# We'll run Overpass around global bbox by skipping around: use large radius at 0,0 (best-effort)
		lat = 0.0
		lng = 0.0
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
	# If q is present, modify query to search names matching q
	if q:
		# escape regex-like characters
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
	async def http_post_with_retry(url, data, timeout=60.0, retries=3):
		delay = 0.5
		for attempt in range(1, retries + 1):
			try:
				async with httpx.AsyncClient(timeout=timeout) as client:
					resp = await client.post(url, data=data)
					return resp
			except Exception as e:
				print(f'Overpass request attempt {attempt} failed: {e}')
				if attempt == retries:
					raise
				await sleep(delay)
				delay *= 2

	try:
		resp = await http_post_with_retry(url, {"data": query}, timeout=60.0, retries=3)
		try:
			data = resp.json()
		except Exception as je:
			print('Overpass response parse error:', je, 'status:', getattr(resp, 'status_code', None))
			try:
				print('Overpass response text:', resp.text[:1000])
			except Exception:
				pass
			raise
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
	# use module-level http_get_with_retry

	try:
		try:
			resp = await http_get_with_retry(url, params=params, timeout=20.0, retries=2, verify=VERIFY_SSL)
		except Exception:
			# last-ditch: try without SSL verification
			resp = await http_get_with_retry(url, params=params, timeout=20.0, retries=1, verify=False)
		if resp.status_code != 200:
			return {"products": []}
		try:
			data = resp.json()
		except Exception as je:
			print('OFF proxy parse error:', je, 'status:', getattr(resp, 'status_code', None))
			try:
				print('OFF proxy response text:', resp.text[:1000])
			except Exception:
				pass
			return {"products": []}
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
		print('OFF proxy error:', repr(e))
		return {"products": []}


@app.get('/api/v1/openfoodfacts/product/{barcode}')
async def off_product(barcode: str):
	if not barcode:
		return {"product": None}
	url = f'https://world.openfoodfacts.org/api/v0/product/{urllib.parse.quote(barcode)}.json'
	try:
		try:
			resp = await http_get_with_retry(url, timeout=20.0, retries=2, verify=VERIFY_SSL)
		except Exception:
			resp = await http_get_with_retry(url, timeout=20.0, retries=1, verify=False)
		if resp.status_code != 200:
			return {"product": None}
		try:
			data = resp.json()
		except Exception as je:
			print('OFF product proxy parse error:', je, 'status:', getattr(resp, 'status_code', None))
			try:
				print('OFF product response text:', resp.text[:1000])
			except Exception:
				pass
			return {"product": None}
		return {"product": data.get('product')}
	except Exception as e:
		print('OFF product proxy error:', repr(e))
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

# Serve legacy style.css if present (some pages request /style.css)
style_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'style.css')
if os.path.exists(style_path):
	@app.get('/style.css')
	def style_css():
		return FileResponse(style_path)

# Serve favicon.ico if present under assets
favicon_path = os.path.join(assets_dir, 'favicon.ico')
if os.path.exists(favicon_path):
	@app.get('/favicon.ico')
	def favicon():
		return FileResponse(favicon_path)

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