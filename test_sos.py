import requests
import json

url = "http://localhost:8000/api/ingestion/sos"
payload = {
    "lat": 13.6288,
    "lng": 79.4192,
    "description": "Test SOS signal from doctor kit",
    "device_id": "DOCTOR-TEST-001"
}

print(f"--- NEXUS SOS ENDPOINT TEST ---")
print(f"Target URL: {url}")
print(f"Payload: {json.dumps(payload, indent=2)}")

try:
    response = requests.post(url, json=payload, timeout=5)
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 200:
        print("\n✅ SOS Endpoint is working correctly!")
    else:
        print("\n❌ SOS Endpoint returned an error.")
        
except Exception as e:
    print(f"\n❌ Connection FAILED: {e}")
    print("👉 Tip: Check if the backend is running and listening on port 8000.")
