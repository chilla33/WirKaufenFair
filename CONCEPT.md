# WirkaufenFair — Konzept & aktueller Projektstatus

Dieses Dokument fasst das bisher Besprochene, die technische Architektur, den aktuellen Implementierungsstand, Test/CI‑Details und empfohlene nächste Schritte zusammen. Ziel ist eine klare Übersicht für Entwickler, Betreiber und Stakeholder.

Datum: 2025-10-20

## 1. Ziel und Scope

- Ziel: Eine kleine Web‑Plattform, die Community‑Produktstandort‑Vorschläge (z. B. Regal / Laden) sammelt, verifizierbar macht und öffentlich darstellt. Zusätzlich: Spenden‑Erfassung, Admin‑Tools, einfache Moderation.
- Fokus der aktuellen Umsetzung: MVP‑Funktionalität (einreichen, persistieren, listen, admin verify/vote), sichere Admin‑Zugriffe und ein einfacher Frontend‑MVP.

## 2. Architektur (kurz)

- Backend: FastAPI + SQLAlchemy, minimal, in `backend/app`.
- Datenbank: pluggable via `DATABASE_URL` (default: sqlite `./backend.db`). Alembic empfohlen für Migrations (nicht vollständig implementiert).
- Frontend: statische HTML/JS/CSS in `frontend/`, simple ES‑Module ohne Build‑Tool.
- Tests: pytest in `backend/tests`, CI via GitHub Actions `.github/workflows/ci.yml`.

## 3. Was ist bereits implementiert (Status)

Die Implementierung ist iterativ entstanden. Hier die wichtigsten Punkte mit Dateipfaden.

- DB & Init
  - `backend/app/database.py` — env‑freundliche Engine (prüft `DATABASE_URL`, sqlite default, `pool_pre_ping=True`).
  - `backend/init_db.py` — Script zum Erzeugen aller Tabellen.
  - `backend/README_DB.md` — Hinweise zum Init und zu Alembic.

- Backend / API
  - `backend/app/main.py` — FastAPI App, Endpunkte, CORS, Static mount.
  - Models/Schemas:
    - `backend/app/product_models.py` + `backend/app/product_schemas.py` — `ProductLocation` Model & Pydantic Schema.
    - `backend/app/donation_models.py` + `backend/app/donation_schemas.py` — `Donation` Model & Schema.
    - `backend/app/models.py` + `backend/app/schemas.py` — Signup & andere Basismodelle.
  - API Endpoints (Wesentlich):
    - `POST /api/v1/product_locations` — Produktvorschlag einreichen (Pydantic validiert).
    - `GET /api/v1/product_locations` — Liste (optional `?product_identifier=`).
    - `POST /api/v1/product_locations/{id}/vote` — Up/Down (Admin‑Action, header `X-API-KEY`).
    - `POST /api/v1/product_locations/{id}/verify` — Verify (Admin‑Action, header `X-API-KEY`).
    - `POST /api/v1/donations` und `GET /api/v1/donations` — Spenden erfassen / listen.

- Frontend (MVP)
  - `frontend/index.html`, `frontend/style.css` — allgemeines Layout und Styles.
  - Suggest: `frontend/suggest_location.html` (+ `frontend/assets/suggest_location.js`) — Formular zum Einreichen.
  - Public list: `frontend/produktvorschlaege.html` und Modul `frontend/assets/product_list_module.js` — paginierte Anzeige der Vorschläge.
  - Admin UI: `frontend/admin/product_locations.html` und `frontend/assets/admin_product_locations.js` — Listing + Buttons (Up/Down/Verify).
  - Spenden: `frontend/donate.html` — PayPal/Stripe placeholders + offline Eintrag.

- Sicherheit / Auth
  - Admin API Actions (vote/verify) schützen wir per API‑Key im Header `X-API-KEY`. Env var: `ADMIN_API_KEY`.
  - Zusätzlich: HTTP Basic Auth middleware (in `backend/app/main.py`) schützt `/admin/*` statische Seiten, wenn `ADMIN_USER` & `ADMIN_PASSWORD` gesetzt sind.
  - Admin‑Frontend fragt (prompt) den API‑Key ab und speichert ihn in `localStorage` (praktisch für MVP). Requests senden `X-API-KEY` Header.

- Tests & CI
  - `backend/tests/test_admin_auth.py` — Tests für Basic Auth middleware und API‑Key Schutz.
  - `backend/requirements-dev.txt` — dev deps (pytest, httpx, pytest-asyncio).
  - `.github/workflows/ci.yml` — CI, installiert deps und führt pytest aus.

## 4. Wichtige Implementierungsdetails

- Static mount:
  - Das Frontend wird unter `/static` bereitgestellt; Root `/` leitet auf `/static/index.html` weiter. Das verhindert, dass StaticFiles API‑Routen überschreibt.

- Admin middleware:
  - Wenn `ADMIN_USER` und `ADMIN_PASSWORD` gesetzt sind, prüft middleware Basic Auth für alle Pfade unter `/admin`.

- Header API Key:
  - `ADMIN_API_KEY` (env var) muss gesetzt sein, um Vote/Verify Endpoints zu schützen. Diese Endpoints prüfen strikt auf Header `X-API-KEY`.

## 5. How to run locally (Entwickler‑Anleitung)

1) Python venv & deps

```pwsh
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
# optional dev deps for tests
pip install -r backend/requirements-dev.txt
```

2) DB init (optional)

```pwsh
python backend/init_db.py
```

3) Start server

```pwsh
# optional: set admin env vars
$env:ADMIN_API_KEY = 'secretkey'
$env:ADMIN_USER = 'admin'
$env:ADMIN_PASSWORD = 's3cret'
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

4) Wichtige URLs

- Frontend: `http://127.0.0.1:8000/` (redirect to `/static/index.html`)
- Produktvorschläge (öffentlich): `http://127.0.0.1:8000/static/produktvorschlaege.html`
- Admin UI (geschützt): `http://127.0.0.1:8000/admin/product_locations.html`
- API docs: `http://127.0.0.1:8000/docs`

5) Tests

```pwsh
pytest -q
```

## 6. Dateien & Änderungen (Kurzliste)

- Backend
  - `backend/app/main.py` — API, middleware (Basic Auth), static mount, admin API key check.
  - `backend/app/database.py` — DB engine setup.
  - `backend/init_db.py`, `backend/README_DB.md` — DB Init & Docs.
  - `backend/tests/test_admin_auth.py` — Tests.
  - `backend/requirements-dev.txt` — dev dependencies for CI.

- Frontend
  - `frontend/produktvorschlaege.html`, `frontend/assets/product_list_module.js` — Produktliste Modul.
  - `frontend/admin/product_locations.html`, `frontend/assets/admin_product_locations.js` — Admin UI (sends `X-API-KEY`).
  - `frontend/donate.html`, `frontend/index.html`, others — basic pages.

- CI
  - `.github/workflows/ci.yml` — runs pytest in CI.

## 7. Sicherheits‑Hinweise

- API‑Keys und Passwörter niemals in Quellcode oder in öffentliche Repos speichern. Verwende GitHub Secrets / env vars auf dem Server.
- localStorage Speicherung des Admin API‑Keys ist praktisch, aber unsicher für hochsensible Umgebungen. Für Produktion: implementiere Login + session cookie oder OAuth2.
- HTTPS (TLS) ist Pflicht in Produktion.

## 8. Nächste sinnvolle Schritte (Priorisiert)

1) Auth / Admin UX (mittel)
   - Ersetze prompt/localStorage durch serverseitiges Login und sichere Session (z. B. FastAPI login endpoint + secure cookie). Alternativ: verwalte Admin‑Keys in DB mit Rotation.

2) Migrations (hoch)
   - Init Alembic scaffold (`backend/alembic`), Erstelle initiale Migration und füge migration steps zu CI hinzu.

3) Payments (mittel)
   - Implementiere Stripe Checkout + webhook endpoint, sichere Spenden‑Aufzeichnung und Payout/Accounting.

4) Photo upload (mittel)
   - Endpoint für Multipart upload, Speicherung lokal oder S3, thumbnails in Produktliste.

5) Server‑seitige Pagination & Filters (niedrig)
   - Erweitere `GET /api/v1/product_locations` um `?page=` `?limit=` und ggf. full‑text Suche.

6) Tests & CI (niedrig)
   - Mehr Unit & integration tests (vote/verify flows, permission cases). Füge flake8/black und test matrix zur CI.

## 9. Offene Themen / Entscheidungen

- DB migrations: noch nicht implementiert (nur create_all). Alembic empfohlen.
- Photo hosting: Architektur (S3 vs local) zu entscheiden.
- Admin user management: derzeit nur env/config. Langfristig DB‑basierte user table + RBAC.

## 10. Kontakt & nächste Schritte

- Sag mir bitte, welche Nummer aus Abschnitt 8 ich als Nächstes umsetzen soll. Ich kann sofort anfangen, die notwendigen Dateien, Tests und CI‑Schritte zu implementieren.

---
Datei erstellt automatisch: `CONCEPT.md` — du kannst sie anpassen oder als Basis für ein Projekt‑Pitch/README verwenden.
