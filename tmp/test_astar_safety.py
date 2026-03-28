import sys
import os
import uuid
from typing import Tuple

# Setup path
sys.path.append(r'e:\Major_Project\NEXUS_Major_Project\backend')

from services.logistics_agent import LogisticsAgent
from database import SessionLocal
import models
from geoalchemy2.elements import WKTElement

def test_safety_routing():
    db = SessionLocal()
    try:
        # 1. Define start/end points in Tirupati
        # Start: Tirupati Railway Station
        start_coords = (13.6288, 79.4192)
        # End: SV University
        end_coords = (13.6350, 79.4300)

        LogisticsAgent.load_graph()

        print("--- PHASE 1: Baseline Routing (No Hazards) ---")
        # Ensure no active hazards in the test area
        db.query(models.DisasterEvent).delete()
        db.commit()

        baseline = LogisticsAgent.calculate_optimal_route(db, end_coords, unit_type="AMBULANCE", preview=True)
        print(f"Baseline: {len(baseline['path_geometry'])} points, {baseline['estimated_time_mins']} mins")

        print("\n--- PHASE 2: Safety-Aware Routing (With Hazard) ---")
        # Place a CRITICAL hazard in the middle of the road toward SV University
        hazard_lat, hazard_lng = 13.6300, 79.4220
        hazard = models.DisasterEvent(
            id=uuid.uuid4(),
            title="TEST HAZARD: FLOOD",
            category="FLOOD",
            location=WKTElement(f'POINT({hazard_lng} {hazard_lat})', srid=4326),
            severity_level="CRITICAL",
            status=models.EventStatus.PENDING
        )
        db.add(hazard)
        db.commit()

        safety_route = LogisticsAgent.calculate_optimal_route(db, end_coords, unit_type="AMBULANCE", preview=True)
        print(f"Safety Route: {len(safety_route['path_geometry'])} points, {safety_route['estimated_time_mins']} mins")

        if len(safety_route['path_geometry']) != len(baseline['path_geometry']):
            print("\nSUCCESS: A* Algorithm found a different (safer) path to avoid the flood zone!")
        else:
            print("\nNOTE: Paths are the same - either the hazard wasn't on the path or the detour was too long.")

    finally:
        # Cleanup
        db.query(models.DisasterEvent).filter(models.DisasterEvent.title == "TEST HAZARD: FLOOD").delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    test_safety_routing()
