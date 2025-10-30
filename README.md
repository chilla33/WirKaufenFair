# 🛒 WirKaufenFair

Open Source App für nachhaltigen und ethischen Einkauf – mit Community-Power.

Pilot: Landingpage
-------------------

Eine einfache Landingpage für Pilot‑Signups liegt unter `frontend/landing.html`.

Backend (lokal laufen lassen)
-----------------------------

Wenn du das Backend lokal starten willst (einfacher Signup‑Endpoint):

1. Abhängigkeiten installieren (empfohlen in einem virtualenv):

```pwsh
pip install -r backend/requirements.txt
```

2. Server starten:

```pwsh
# from repo root
# Recommended: use the wrapper script (works on WSL / macOS / Linux)
bash backend/run.sh

# On Windows (PowerShell) or if you prefer to call uvicorn directly from the repo root,
# point to the backend package module to avoid importing the top-level `app/` package:
& ./.venv/Scripts/Activate.ps1
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Der Signup‑Endpoint ist dann unter `http://localhost:8000/api/v1/signup` erreichbar.
