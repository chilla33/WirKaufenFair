# 🗺️ Store-Finder mit Google Maps / OpenStreetMap

## Features

### 1. **Automatische Laden-Erkennung**
- Nutzt Google Maps Places API oder OpenStreetMap Overpass API
- Findet Supermärkte, Discounter, Drogeriemärkte in Umgebung
- Importiert offizielle Daten:
  - ✅ Exakter Name (z.B. "REWE Drochtersen")
  - ✅ Vollständige Adresse
  - ✅ GPS-Koordinaten (Lat/Lng)
  - ✅ Bewertungen (nur Google)
  - ✅ Entfernung zum User

### 2. **Intelligente Sortierung**
- GPS-basiert: Nächste Läden zuerst
- Fallback: Alphabetisch nach Kette
- Im Dropdown: `REWE Drochtersen (1.2 km)`

### 3. **Kostenlose & Premium-Option**

#### Option A: OpenStreetMap (kostenlos)
```
✅ Komplett kostenlos
✅ Open Source Community-Daten
⚠️ Manchmal unvollständig
⚠️ Keine Öffnungszeiten
```

#### Option B: Google Maps (empfohlen)
```
✅ $200 Guthaben/Monat kostenlos
✅ Sehr genaue Daten
✅ Öffnungszeiten, Fotos, Bewertungen
⚠️ Danach kostenpflichtig
```

---

## Setup

### Google Maps API Key (empfohlen)

**1. Google Cloud Console öffnen:**
https://console.cloud.google.com/

**2. Neues Projekt erstellen:**
- Name: "WirkaufenFair"
- Projekt-ID wird automatisch generiert

**3. Places API aktivieren:**
- APIs & Services → Library
- Suche "Places API"
- Klicke "Enable"

**4. API Key erstellen:**
- APIs & Services → Credentials
- Create Credentials → API Key
- Kopiere Key: `AIzaSyC...`

**5. API Key beschränken (Security):**
```
Application restrictions:
→ HTTP referrers
→ Add: localhost:8000/*, yourwebsite.com/*

API restrictions:
→ Restrict key
→ Select: Places API, Geocoding API
```

**6. In Frontend einfügen:**
```javascript
// store_finder.html, Zeile ~250
document.getElementById('api-key-input').value = 'AIzaSyC...';
```

**Kosten:**
- Erste $200/Monat: Kostenlos
- ~$17 pro 1000 Requests danach
- Für MVP: Reicht kostenlos völlig aus

---

### OpenStreetMap (kostenlos)

**Kein Setup nötig!**
- Einfach ohne API Key nutzen
- Overpass API ist öffentlich verfügbar
- Rate-Limit: ~10 Requests/Minute

**Nutzung:**
```javascript
// Einfach API Key-Feld leer lassen
// → Frontend nutzt automatisch OSM
```

---

## Nutzung

### 1. Läden in Nähe finden

**Im Browser:**
```
http://localhost:8000/static/store_finder.html
```

**Workflow:**
1. GPS-Permission erlauben (optional)
2. Oder Stadt eingeben: "Drochtersen"
3. Kette wählen (optional): "REWE"
4. Klick "🔍 Suchen"
5. Karte zeigt Marker
6. Liste zeigt Läden mit Distanz

### 2. Läden importieren

**Per Klick:**
- Klicke "✓ Importieren" bei jedem Laden
- Speichert in DB: `stores` Tabelle
- Button wird grau: "✓ Importiert"

**Bulk-Import (später):**
```python
# Python-Script für Massen-Import
for city in ['Hamburg', 'Bremen', 'Berlin']:
    stores = google_maps.find_nearby(city, radius_km=10)
    for store in stores:
        db.add(Store(**store))
```

### 3. In Einkaufsliste nutzen

**Automatisch:**
- `shopping_list.html` lädt Stores aus `/api/v1/stores`
- Sortiert nach GPS-Distanz (falls verfügbar)
- Zeigt Entfernung: `REWE Drochtersen (1.2 km)`

---

## API-Endpoints

### `POST /api/v1/stores`
Erstellt neuen Laden (wird von store_finder.html genutzt)

**Request:**
```json
{
  "chain": "REWE",
  "location": "Drochtersen",
  "full_name": "REWE Drochtersen",
  "address": "Hauptstraße 12, 21706 Drochtersen",
  "postal_code": "21706",
  "city": "Drochtersen",
  "latitude": 53.7123,
  "longitude": 9.3456
}
```

**Response:**
```json
{
  "id": 1,
  "chain": "REWE",
  "full_name": "REWE Drochtersen",
  "is_active": true,
  "created_at": "2025-10-22T12:00:00"
}
```

---

### `GET /api/v1/stores`
Lädt Stores, optional mit GPS-Sortierung

**Ohne GPS:**
```
GET /api/v1/stores?limit=100
→ Alle Stores, alphabetisch
```

**Mit GPS (nächste zuerst):**
```
GET /api/v1/stores?lat=53.7&lng=9.3&radius_km=50
→ Nur Stores im 50km-Radius, sortiert nach Distanz
```

**Filter:**
```
GET /api/v1/stores?chain=REWE&city=Drochtersen
→ Nur REWE in Drochtersen
```

---

### `GET /api/v1/stores/{id}`
Lädt einzelnen Store

**Response:**
```json
{
  "id": 1,
  "chain": "REWE",
  "location": "Drochtersen",
  "full_name": "REWE Drochtersen",
  "address": "Hauptstraße 12, 21706 Drochtersen",
  "latitude": 53.7123,
  "longitude": 9.3456,
  "is_active": true
}
```

---

### `DELETE /api/v1/stores/{id}`
Deaktiviert Store (Soft-Delete)

**Response:**
```json
{
  "message": "Store deactivated"
}
```

---

## Datenbank-Schema

### Tabelle: `stores`

```sql
CREATE TABLE stores (
    id INTEGER PRIMARY KEY,
    chain VARCHAR(100) NOT NULL,  -- REWE, EDEKA, ...
    location VARCHAR(200),         -- Drochtersen, Hamburg Altona
    full_name VARCHAR(300) UNIQUE, -- "REWE Drochtersen"
    address VARCHAR(300),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    latitude FLOAT,
    longitude FLOAT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Indizes:**
```sql
CREATE INDEX idx_stores_chain ON stores(chain);
CREATE INDEX idx_stores_city ON stores(city);
CREATE INDEX idx_stores_location ON stores(latitude, longitude);
```

---

## Verwendung in Frontend

### shopping_list_v2.js

**Automatische GPS-Sortierung:**
```javascript
// Beim Laden
let storesUrl = '/api/v1/stores?limit=200';
if (userLocation) {
    storesUrl += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
}

const stores = await fetch(storesUrl).then(r => r.json());

// Dropdown zeigt:
// REWE (alle Filialen)
//   → REWE Drochtersen (1.2 km)  ← Nächster
//   → REWE Stade (5.4 km)
//   → REWE Hamburg (45 km)
```

---

## Roadmap

### Phase 1: Jetzt ✅
- ✅ Store-Finder UI
- ✅ Google Maps / OSM Integration
- ✅ Import in DB
- ✅ GPS-Sortierung im Dropdown

### Phase 2: Diese Woche
- ⏳ Öffnungszeiten importieren (Google)
- ⏳ Fotos importieren
- ⏳ Automatischer Sync (täglich neue Läden suchen)

### Phase 3: Später
- ⏳ Store-Manager-Verifizierung
- ⏳ User können fehlende Läden melden
- ⏳ Crowdsourced Updates (Schließungen, Umzüge)

---

## Tipps & Tricks

### Beste Ergebnisse mit Google Maps:
```javascript
// Mehrere Kategorien abfragen
const types = [
    'supermarket',
    'grocery_or_supermarket',
    'department_store'
];

// Ketten-spezifische Keywords
const keywords = {
    'REWE': 'REWE supermarket',
    'ALDI': 'ALDI discount',
    'dm': 'dm drogerie'
};
```

### OSM: Bessere Queries
```overpassql
[out:json];
(
  node["shop"~"supermarket|department_store|convenience"](around:5000,53.7,9.3);
  way["shop"~"supermarket|department_store|convenience"](around:5000,53.7,9.3);
  node["name"~"REWE|EDEKA|ALDI"](around:5000,53.7,9.3);
);
out center;
```

### Duplikate vermeiden:
```javascript
// Check ob Store schon existiert
const existing = await fetch(`/api/v1/stores?chain=${chain}&location=${location}`);
if (existing.length > 0) {
    console.log('Store already exists, skipping');
    return;
}
```

---

## Troubleshooting

### "API Key ungültig"
→ Prüfe ob Places API aktiviert ist in Google Cloud Console

### "CORS Error"
→ Füge `localhost:8000` zu allowed origins hinzu in API-Restrictions

### "Keine Läden gefunden"
→ Erhöhe Radius: `radius_km=50` statt 5
→ Oder nutze größeren Ort: "Hamburg" statt "Dorf XY"

### "Rate Limit erreicht" (OSM)
→ Warte 1 Minute zwischen Requests
→ Oder nutze Google Maps (höheres Limit)

---

## Kosten-Kalkulation

### Google Maps (200$/Monat kostenlos)

**Places Nearby Search:**
- $32 pro 1000 Requests
- Kostenlos: ~6250 Requests/Monat

**Beispiel:**
- 100 Städte × 10 Requests = 1000 Requests
- → Völlig kostenlos
- Erst bei >6000 Requests/Monat kostet es

**Tipp:** Cachen!
```javascript
// Cache Ergebnisse 7 Tage
localStorage.setItem('stores_hamburg', JSON.stringify(stores));
```

---

**Happy Mapping! 🗺️**
