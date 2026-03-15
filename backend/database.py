import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Database configuration from environment variables
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "onestopanalytics")

# Construct the URL if individual components are provided
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Try PostgreSQL first, but we'll use a try-except to fallback to SQLite
    # For now, let's explicitly use SQLite as a reliable fallback for dev
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# We'll use SQLite as a fallback if the connection fails or if requested
try:
    # Test if PostgreSQL is available
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 2})
    engine.connect()
    _HAS_PSYCOPG2 = True
    print("SUCCESS: Connected to PostgreSQL.")
except Exception as e:
    print(f"WARNING: PostgreSQL connection failed ({e}). Falling back to SQLite for local development.")
    DATABASE_URL = "sqlite:///./analytics.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    _HAS_PSYCOPG2 = False

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def create_database_if_not_exists():
    if not _HAS_PSYCOPG2:
        return
    # Connect to the default 'postgres' database to create the new one
    try:
        conn = psycopg2.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Check if database exists
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{DB_NAME}'")
        exists = cur.fetchone()
        
        if not exists:
            cur.execute(f"CREATE DATABASE {DB_NAME}")
            print(f"Database '{DB_NAME}' created successfully!")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Warning: Could not create database automatically. Error: {e}")
        print("Please ensure your PostgreSQL server is running and credentials are correct in .env")

def init_db():
    # Attempt to create database first if using Postgres
    if _HAS_PSYCOPG2:
        create_database_if_not_exists()
    
    # Import models here to ensure they are registered with Base
    from models import (User, UploadedFile, FileColumn, ColumnStatistic, GraphDefinition,
                        UserDatabaseConnection, ETLConnection, ETLPipeline, ETLPipelineVersion,
                        ETLWorkflowNode, ETLWorkflowEdge, ETLTransformRule, ETLSchedule,
                        ETLJob, ETLJobStep, ETLJobLog, ETLDataQualityCheck, AuditLog, UserRole)
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables verified/created successfully!")
    except Exception as e:
        print(f"Error creating tables: {e}")

if __name__ == "__main__":
    init_db()
