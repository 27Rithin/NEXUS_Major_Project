import asyncio
from database import SessionLocal
import models
from utils.spatial import create_point

def seed_units():
    db = SessionLocal()
    
    # Check if we already have units
    if db.query(models.RescueUnit).count() > 0:
        print("Units already seeded. Skipping.")
        db.close()
        return

    # 5 distributed positions around Tirupati
    units_data = [
        {"callsign": "AMB-01", "type": models.UnitType.AMBULANCE, "lat": 13.6288, "lng": 79.4192}, # HQ / Ruia
        {"callsign": "AMB-02", "type": models.UnitType.AMBULANCE, "lat": 13.6200, "lng": 79.4000}, # West
        {"callsign": "DRN-01", "type": models.UnitType.DRONE,     "lat": 13.6400, "lng": 79.4300}, # North-East
        {"callsign": "BOT-01", "type": models.UnitType.BOAT,      "lat": 13.6100, "lng": 79.4100}, # South
        {"callsign": "AMB-03", "type": models.UnitType.AMBULANCE, "lat": 13.6350, "lng": 79.3950}, # North-West
    ]

    for data in units_data:
        unit = models.RescueUnit(
            callsign=data["callsign"],
            unit_type=data["type"],
            location=create_point(data["lat"], data["lng"]),
            status=models.RescueUnitStatus.AVAILABLE
        )
        db.add(unit)

    db.commit()
    print("Successfully seeded 5 dynamic Rescue Units.")
    db.close()

if __name__ == "__main__":
    seed_units()
