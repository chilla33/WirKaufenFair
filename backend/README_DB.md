Database initialization
-----------------------

This project uses SQLAlchemy. By default it uses a local sqlite file `backend.db`.

Initialize the DB (create tables):

```pwsh
python backend/init_db.py
```

Environment variable `DATABASE_URL` can point to other DBs (Postgres, MySQL):

Example (Postgres):

```pwsh
$env:DATABASE_URL = 'postgresql://user:pass@localhost:5432/wf'
python backend/init_db.py
```

Migrations
----------
We recommend using Alembic for schema migrations. A basic alembic setup can be added under `backend/alembic` and configured to import `app.models` and `app.product_models`.
