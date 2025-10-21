# WirKaufenFair

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
bash backend/run.sh
```

Der Signup‑Endpoint ist dann unter `http://localhost:8000/api/v1/signup` erreichbar.
