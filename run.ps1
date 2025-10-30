# Run backend (PowerShell helper)
# Usage: From repository root: .\run.ps1

# Ensure running from repo root
$PSScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location $PSScriptRoot

# optional: set DATABASE_URL same as backend/run.sh
$env:DATABASE_URL = "sqlite:///./backend.db"

# Activate venv (adjust path if your venv is located elsewhere)
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    & .\.venv\Scripts\Activate.ps1
} else {
    Write-Host "Virtualenv activation script not found at .\.venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "Activate your virtualenv manually before running the server." -ForegroundColor Yellow
}

# Start uvicorn using package module path so Python finds `backend.app` package
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
