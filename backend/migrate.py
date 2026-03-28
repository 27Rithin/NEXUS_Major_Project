import os
from sqlalchemy import create_engine, text
from database import engine
import models

def run_migrations():
    print("Running NEXUS Database Migrations...")
    
    # 1. Create all tables if they don't exist
    models.Base.metadata.create_all(bind=engine)
    print("[OK] Base tables created/verified.")
    
    # 2. Add new columns to existing tables if missing (Simple manual migrations)
    with engine.connect() as conn:
        # DisasterEvent: review_deadline, decision_log, vision_status
        columns_to_add = {
            "disaster_events": [
                ("review_deadline", "TIMESTAMP WITH TIME ZONE"),
                ("decision_log", "JSONB DEFAULT '[]'"),
                ("vision_status", "VARCHAR(50) DEFAULT 'PENDING'")
            ]
        }
        
        for table, cols in columns_to_add.items():
            for col_name, col_type in cols:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
                    print(f"[OK] Added column {col_name} to {table}.")
                except Exception:
                    # Column likely already exists
                    pass
        
        # Add GIN Index
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_disaster_events_decision_log ON disaster_events USING GIN (decision_log)"))
            print("[OK] GIN Index verified.")
        except Exception:
            pass

        conn.commit()
    
    print("\n[SUCCESS] Migrations completed.")

if __name__ == "__main__":
    run_migrations()
