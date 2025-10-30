#!/bin/bash
export DATABASE_URL="sqlite:///./backend.db"
# Use module form so the current Python env's uvicorn is used.
# Run the backend package module to avoid conflicts with a top-level `app/` package
# when this script is executed from the repository root.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
