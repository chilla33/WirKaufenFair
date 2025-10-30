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
    Write-Host "Attempting to create a virtual environment at .\.venv using 'python -m venv .\.venv'..." -ForegroundColor Yellow
    try {
        python -m venv .\.venv
        if (Test-Path ".\.venv\Scripts\Activate.ps1") {
            Write-Host "Virtual environment created. Activating..." -ForegroundColor Green
            & .\.venv\Scripts\Activate.ps1
        } else {
            Write-Host "Created .venv but activation script still not found. Please activate your venv manually." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Failed to create virtual environment automatically. Please create and activate a venv manually." -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
    }
}

# Start uvicorn using package module path so Python finds `backend.app` package
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
