from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Use DATABASE_URL env var. Default to sqlite file in repo root for dev.
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./backend.db')

# If using sqlite file, ensure check_same_thread option
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {}

# create engine with pool_pre_ping for reliability with some DB providers
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
