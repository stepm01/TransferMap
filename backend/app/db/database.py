"""
Database Configuration
For demo: SQLite, for production: PostgreSQL via Firebase/Supabase
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Use environment variable or default to SQLite for demo
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./transfer_verifier.db")

# Handle PostgreSQL URLs from common cloud providers
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    from app.models.models import Base
    Base.metadata.create_all(bind=engine)
