import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

print("--- TESTING IMPORTS ---")

try:
    from config import settings
    print("[OK] config.settings")
except Exception as e:
    print(f"[FAIL] config.settings: {e}")
    import traceback
    traceback.print_exc()

try:
    import models
    print("[OK] models")
except Exception as e:
    print(f"[FAIL] models: {e}")
    import traceback
    traceback.print_exc()

try:
    import schemas
    print("[OK] schemas")
except Exception as e:
    print(f"[FAIL] schemas: {e}")
    import traceback
    traceback.print_exc()

try:
    from routers import disaster_events, agents, auth, websockets, ingestion
    print("[OK] routers")
except Exception as e:
    print(f"[FAIL] routers: {e}")
    import traceback
    traceback.print_exc()

print("--- IMPORT TEST COMPLETE ---")
