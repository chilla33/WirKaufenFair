"""Initialize database (create tables). Run: python backend/init_db.py"""
from app.database import engine, Base
from app import models
from app import product_models, donation_models


def init():
    Base.metadata.create_all(bind=engine)
    try:
        product_models.Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        donation_models.Base.metadata.create_all(bind=engine)
    except Exception:
        pass


if __name__ == '__main__':
    print('Initializing DB...')
    init()
    print('DB initialized.')
