Deployment (Docker Compose)
===========================

This project contains a minimal Docker Compose setup to run the backend and an Nginx reverse proxy for static frontend files.

Prerequisites
- Docker and Docker Compose installed on the machine.
- Copy `.env.example` to `.env` and set secrets.

Steps
1) Build and start:

```bash
cp .env.example .env
# edit .env and fill secrets
docker compose up --build -d
```

2) Open the app in your browser: http://<server-ip>/

Notes
- Nginx serves the static frontend from the `frontend/` folder and proxies `/api/` and `/admin/` to the backend container.
- In production, replace sqlite with a proper RDBMS and configure `DATABASE_URL` accordingly.
- Do NOT store secrets in the repo; use environment variables or secret managers.

Troubleshooting
- Check logs:
  - `docker compose logs web`
  - `docker compose logs nginx`

