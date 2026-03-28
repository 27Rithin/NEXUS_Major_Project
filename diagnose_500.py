import sys
import os
from sqlalchemy import create_engine, text
from geoalchemy2.shape import to_shape

# Hardcoded for test
db_url = "postgresql+psycopg2://postgres:Helenricky%4004@127.0.0.1:5432/nexus"

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
import models

def test_fetch_events():
    engine = create_engine(db_url)
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        print("[TEST] Querying DisasterEvents directly...")
        events = db.query(models.DisasterEvent).all()
        print(f"[OK] Found {len(events)} events.")
        
        for i, event in enumerate(events):
            try:
                print(f"--- Event {i+1} (ID: {event.id}) ---")
                print(f"Title: {event.title}")
                print(f"Location type: {type(event.location)}")
                
                # Verify location data
                loc_blob = event.location
                if loc_blob is None:
                    print("❌ ERROR: location is NULL!")
                    continue
                
                print(f"Raw blob: {loc_blob[:15]}...")
                
                # Check for to_shape failure
                try:
                    shape = to_shape(event.location)
                    print(f"Coordinates (to_shape): {shape.x}, {shape.y}")
                except Exception as e:
                    print(f"❌ to_shape FAILED: {e}")
                    
            except Exception as e:
                 print(f"❌ Loop Error on Event {i+1}: {e}")
                
    except Exception as e:
        print(f"❌ MASTER ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_fetch_events()
