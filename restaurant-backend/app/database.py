import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ======================================================
# ENVIRONMENT (WAJIB)
# ======================================================
ENV = os.getenv("ENV")

if ENV not in ("development", "production"):
    raise RuntimeError("ENV must be set to 'development' or 'production'")

# ======================================================
# DATABASE URL (WAJIB)
# ======================================================
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in environment variables")

# ======================================================
# ENGINE CONFIG
# ======================================================
engine_args = {
    "pool_pre_ping": True,
    "future": True,
    "echo": ENV == "development",
}
if ENV == "production" and DATABASE_URL.startswith("postgresql"):
    engine_args["connect_args"] = {"sslmode": "require"}

if ENV == "production":
    engine_args.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,
        "pool_timeout": 30
    })

engine = create_engine(DATABASE_URL, **engine_args)

# ======================================================
# SESSION
# ======================================================
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

# ======================================================
# BASE MODEL
# ======================================================
Base = declarative_base()

# ======================================================
# DEPENDENCY
# ======================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
