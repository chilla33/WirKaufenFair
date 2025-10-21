Admin access protection
=======================

This project includes an optional Basic Auth middleware to protect `/admin` static pages.

How it works
- If both `ADMIN_USER` and `ADMIN_PASSWORD` environment variables are set, any request under `/admin` will require HTTP Basic Auth.
- The middleware checks the `Authorization: Basic ...` header and returns `401` with `WWW-Authenticate` when missing/invalid.

Local test (PowerShell)
```pwsh
$env:ADMIN_USER = 'admin'
$env:ADMIN_PASSWORD = 's3cret'
python -m uvicorn backend.app.main:app --reload
# open http://127.0.0.1:8000/admin/product_locations.html in browser -> browser will prompt for credentials
```

Nginx (reverse proxy) example
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Notes
- This is a lightweight protection suitable for small pilots. For production, use proper auth (OAuth2/JWT) and TLS.
