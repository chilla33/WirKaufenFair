# Produkt Schema (Backend) — mit Ethik Feldern

Dieses Dokument beschreibt das minimale Produkt‑Schema für das Backend, einschließlich der Felder, die für Ethik‑Bewertungen benötigt werden.

## Produkt (product)
- id: integer (PK)
- name: string
- brand: string
- category: string
- ean / gtin: string (nullable)
- description: text
- price: float (nullable)
- material_scores: json {recyclability:int, toxic_substances:int}
- repairability_score: int
- co2_estimate: float
- social_score: int
- packaging_score: int
- ethics_score: int
- ethics_flags: json array
- ethics_evidence: json array [{type, url, summary, confidence}]
- ethics_verified: boolean
- computed_score: float
- availability: json array [{vendor_id, price, stock, shipping_distance_km}]
- created_at, updated_at

## ProductLocation (for in‑store positions)
- id
- product_id
- store_id
- aisle
- shelf_label
- photo_url
- contributor_id
- verified_by
- status: suggested|verified|deprecated
- upvotes, downvotes
- created_at

## Hinweise
- Alle Score‑Felder liegen auf 0–100 Skala. Aggregation in `computed_score` normalisiert Werte.
- `ethics_evidence` sollte beim Import validiert werden (URL reachable, filetype allowed for photos).
