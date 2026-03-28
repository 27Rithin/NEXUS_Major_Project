import sys
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Add backend to path for config
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from config import settings
except ImportError:
    print("[ERROR] Could not import settings.")
    sys.exit(1)

def init_database():
    print("="*60)
    print(" NEXUS DATABASE INITIALIZER")
    print("="*60)

    # 1. Parse connection string for base 'postgres' DB
    # Example: postgresql+psycopg2://postgres:pass@localhost:5432/nexus
    # We need: user=postgres password=pass host=localhost port=5432 dbname=postgres
    
    from sqlalchemy.engine.url import make_url
    url = make_url(settings.DATABASE_URL)
    
    user = url.username
    password = url.password
    host = "127.0.0.1"
    port = url.port or 5432
    target_db = url.database

    print(f"Connecting to PostgreSQL as '{user}'...")
    
    try:
        # Connect to 'postgres' (the default administrative database)
        conn = psycopg2.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            dbname="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Check if 'nexus' DB exists
        print(f"Checking for database '{target_db}'...")
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{target_db}'")
        exists = cur.fetchone()
        
        if not exists:
            print(f"[SETUP] Creating database '{target_db}'...")
            cur.execute(f"CREATE DATABASE {target_db}")
            print(f"[SUCCESS] Database '{target_db}' created.")
        else:
            print(f"[INFO] Database '{target_db}' already exists.")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] FAILED to initialize database: {e}")
        print("Tip: Make sure the PostgreSQL service is running and the password is correct.")
        sys.exit(1)

    print("\n" + "="*60)
    print(" INITIALIZATION COMPLETE")
    print("="*60)

if __name__ == "__main__":
    init_database()
