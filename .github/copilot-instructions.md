Guidance for AI coding agents working on WirkaufenFair

Schreibe mit mir auf Deutsch.

- Setzte immer das nächste wichtige um.
- Prüfe immer was es für Fehler gibt und korrigiere sie.

This repository is a small full-stack app (FastAPI backend + vanilla JS frontend). The goal of this document is to highlight the project-specific architecture, common developer workflows, integration points and conventions so an AI agent can make safe, focused edits.

High-level architecture (big picture)
- Backend: `backend/app` (FastAPI). Key files: `main.py` mounts static frontend, registers routers (e.g. `openfoodfacts_routes.py`, `store_routes.py`), and exposes API endpoints under `/api/v1`. Database models live in `backend/app/*.py` (e.g. `models.py`, `product_models.py`). Use `backend/run.sh` or `python -m uvicorn app.main:app --reload` to run locally.
- Frontend: `frontend/` static files. Main UI is `frontend/shopping_list.html`. JS lives in `frontend/assets/` with a `modules/` folder for modularized code (e.g. `addflow.js`, `autocomplete.js`, `matcher.js`, `scoring.js`, `renderer.js`). `main.js` wires modules together.
- Data flows: Frontend calls backend API (e.g. `/api/v1/openfoodfacts`, `/api/v1/stores`) which either proxies OpenFoodFacts or executes Overpass queries. Product suggestions are fetched from OFF and returned to the frontend where matching/scoring runs in modules/matcher.js and modules/scoring.js.

Key integration points
- OpenFoodFacts: backend `backend/app/openfoodfacts.py` and frontend `frontend/assets/modules/openfoodfacts.js` (client). Search/lookup endpoints live under `/api/v1/openfoodfacts`.
- Stores/Overpass: `backend/app/store_routes.py` builds Overpass queries. Frontend store dropdown uses `frontend/assets/modules/store-api.js` to query `/api/v1/stores`.
- Static serving: `main.py` mounts `frontend` at `/static` and `assets` at `/assets` — frontend code expects absolute asset paths like `/assets/...`.

Developer workflows & commands
- Run backend locally (venv recommended):
  - pip install -r backend/requirements.txt
  - cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  - or use `./backend/run.sh` which sets DATABASE_URL and runs uvicorn.
- Docker: `docker-compose.yml` and `backend/Dockerfile` exist for containerized runs. See `README_DEPLOY.md` for deployment notes.
- Tests: backend tests use pytest (see `backend/tests`). Install dev requirements in `backend/requirements-dev.txt` and run `pytest backend/tests`.

Project-specific conventions & patterns
- Minimal-framework frontend: vanilla ES modules (type="module" in the HTML). Add new modules under `frontend/assets/modules/` and import them in `frontend/assets/main.js` to wire up.
- Global/window state: frontend uses several `window._*` globals (e.g. `window._pendingOffProduct`, `window._pendingSuggestions`) and exposes a few functions globally (e.g. `window.confirmPendingItem`) because HTML buttons call them via onclick. Prefer updating these carefully (avoid duplicate listeners).
- DOM-first rendering: modules directly set innerHTML and inline styles (many components render via template strings). Small style changes are often inline in JS — move to `style.css` when making broader UI edits.
- LocalStorage keys: the frontend uses keys such as `pendingSortByFair` and `wirkaufenfair_store`. Respect existing keys when adding preferences.
- Two versions coexist: `shopping_list_v2.js` (legacy single-file implementation) and modular `main.js` + `modules/*`. Use the modular approach for new work but reference `shopping_list_v2.js` for expected behavior if something differs.

Files that exemplify important patterns (read first)
- `frontend/assets/modules/addflow.js` — shows add-item flow: fetching OFF, rendering pending-selection, confirm/cancel. Good example for DOM rendering + persistence hooks.
- `frontend/assets/modules/autocomplete.js` — input-driven autocomplete, careful with event handling and element containment checks.
- `frontend/assets/modules/scoring.js` & `backend/app/scoring.py` — scoring logic split between backend and frontend; watch for duplication and normalization differences.
- `backend/app/main.py` — how static files are mounted and middleware (admin basic auth) is implemented; environment-driven behavior (ADMIN_USER/PASSWORD, ADMIN_API_KEY).

Safe edit rules for AI agents
- Do not remove or rename the `/static` and `/assets` mount behavior in `backend/app/main.py`. Frontend assumes absolute `/assets/...` paths.
- When changing frontend global functions (exposed on `window`), keep backward compatibility: HTML contains direct onclick attributes referencing them.
- Avoid heavy refactors that change the public API (routes or DB schema) without updating migration or seed scripts (see `backend/seed_*` and `init_db.py`). If you must change DB models, update `backend/README_DB.md` and provide migration steps.
- When modifying scoring or matching, update both frontend (`modules/scoring.js`) and backend (`backend/app/scoring.py`) if necessary; include unit tests for backend logic.

Examples: common edits an agent might do
- Add a new frontend module `modules/foo.js`: create file, export setupFoo(), import & call from `frontend/assets/main.js` inside DOMContentLoaded initialization.
- Add a new API route: create `backend/app/foo_routes.py` with a FastAPI router and import/register it in `backend/app/main.py` similar to other routers.
- Debugging suggestion: run backend, open `http://localhost:8000/static/shopping_list.html`, use browser DevTools console — many modules log internal state (useful to validate changes).

QA & where to look if something breaks
- If the suggestions panel disappears after rendering, inspect `frontend/assets/modules/addflow.js` — historically a render function cleared the suggestions DOM node; avoid accidental innerHTML clears.
- If assets 404, confirm `main.py` mounts `/assets` and `/static`, and that files are under `frontend/assets/`.

If anything in this doc is unclear, tell me which area you want expanded (routing, frontend wiring, DB conventions, or CI/test commands) and I will iterate.
