import sys
import os
sys.path.append(os.getcwd())

from services.logistics_agent import LogisticsAgent
import logging

logging.basicConfig(level=logging.INFO)

print("Attempting to load graph...")
try:
    LogisticsAgent.load_graph()
    print("SUCCESS")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
