#!/bin/bash
export DATABASE_URL="sqlite:///./backend.db"
# Use module form so the current Python env's uvicorn is used
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
