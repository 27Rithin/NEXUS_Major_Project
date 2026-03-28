# NEXUS Maintenance & Troubleshooting Guide

If you encounter issues (e.g., "NO NETWORK", "Failed to fetch") after a system restart, follow these steps to restore the system.

## 1. The "127.0.0.1" vs "localhost" Rule
Windows sometimes struggles to resolve `localhost` correctly between IPv4 and IPv6. 
- **Rule**: Always use `http://127.0.0.1:8000` for your API and `http://127.0.0.1:5173` for your Dashboard in the browser if `localhost` fails.
- We have pre-configured the system to prefer `127.0.0.1` in the `.env` files for stability.

## 2. Common Fixes

### ❌ Problem: "Failed to fetch active events" (Dashboard)
**Cause**: The database schema is out of sync with the backend code.
**Fix**:
1. Open a terminal in the `backend` folder.
2. Run: `venv\Scripts\activate`
3. Run: `alembic upgrade head`

### ❌ Problem: "NO NETWORK" (Citizen App SOS)
**Cause**: The browser is blocking the request (CORS) or the backend is not listening.
**Fix**:
1. Ensure the backend CMD window shows "Uvicorn running on http://0.0.0.0:8000".
2. Ensure you are accessing the app via `http://127.0.0.1:5173`.

### ❌ Problem: "API DOWN" (Red Badge)
**Cause**: PostgreSQL or the Backend service is not running.
**Fix**: 
1. Run `start.bat` again (it will auto-detect and restart services).
2. Check if PostgreSQL is running in Windows Services (Win + R -> `services.msc` -> `postgresql-x64-16`).

## 3. Automated Repair Script
I have provided a `repair_nexus.bat` in the root directory. If things feel broken:
1. Double-click `repair_nexus.bat`.
2. It will:
   - Identify and kill zombie processes.
   - Verify PostgreSQL connection.
   - Run all pending database migrations.
   - Clear frontend cache.

## 4. Checking the Logs
If you need to report a bug, look at these files:
- `startup.log`: Detailed logs from the `start.bat` process.
- The output of the **Backend** CMD window (real-time Python errors).
