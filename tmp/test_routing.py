
import sys
import os
sys.path.append(r'e:\Major_Project\NEXUS_Major_Project\backend')

from services.logistics_agent import LogisticsAgent
from database import SessionLocal

# Tirupati Coordinates
start = (13.6288, 79.4192)
end = (13.6350, 79.4300)

db = SessionLocal()
try:
    # Initialize graph if not already
    LogisticsAgent.load_graph()

    print(f"Testing Integrated Road-Aware Routing from {start} to {end}...")
    result = LogisticsAgent.calculate_optimal_route(db, end, unit_type="AMBULANCE", preview=True)

    path = result.get("path_geometry")
    time = result.get("estimated_time_mins")

    if path:
        print(f"SUCCESS! Found route with {len(path)} waypoints.")
        print(f"Estimated time: {time:.2f} mins")
        if len(path) > 2:
            print("VERIFIED: Route follows roads (OSMnx/OSRM integrated).")
        else:
            print("WARNING: Route is a straight line (fallback failed).")
    else:
        print("FAILED: No route found.")
finally:
    db.close()
