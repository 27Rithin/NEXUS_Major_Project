import asyncio
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine
import models
from services.monitoring_service import automated_monitoring_loop
from services.logistics_agent import LogisticsAgent
from config import settings

app = FastAPI(
    title="NEXUS - Multi-Modal Disaster Response Agent API",
    description="Backend API for NEXUS Disaster Response system",
    version="1.0.0"
)
app.router.redirect_slashes = True

# -------------------- CORS --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- ROOT --------------------
@app.get("/")
def read_root():
    return {"message": "Welcome to NEXUS Disaster Response API"}

@app.get("/api/ping")
def ping():
    """Fastest possible handshake for connectivity tracking."""
    return {"status": "ok"}

@app.get("/api/health")
def health_check():
    """Deep Health Check: Verifies DB, Tables, and Spatial Extensions."""
    response = {
        "api": "ok",
        "database": "unknown",
        "spatial": "unknown",
        "events_table": "unknown",
        "status": "unknown"
    }

    try:
        with engine.connect() as conn:
            # 1. Basic Connection
            conn.execute(text("SELECT 1"))
            response["database"] = "ok"

            # 2. Spatial Check (PostGIS)
            try:
                spatial_check = conn.execute(text("SELECT PostGIS_Version()")).scalar()
                response["spatial"] = f"active ({spatial_check})"
            except Exception:
                response["spatial"] = "missing_extension"

            # 3. Table Integrity Check
            try:
                conn.execute(text("SELECT 1 FROM disaster_events LIMIT 1"))
                response["events_table"] = "ok"
            except Exception:
                response["events_table"] = "not_found"

        if response["database"] == "ok" and "active" in response["spatial"] and response["events_table"] == "ok":
            response["status"] = "healthy"
        else:
            response["status"] = "degraded"
            if response["spatial"] == "missing_extension" or response["events_table"] == "not_found":
                response["status"] = "initializing"

    except Exception as e:
        response["database"] = "error"
        response["error"] = str(e)
        response["status"] = "down"

    return response

# -------------------- ROUTERS --------------------
from routers import disaster_events, agents, auth, websockets, ingestion

app.include_router(disaster_events.router, prefix="/api/events", tags=["Events"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["Ingestion"])
app.include_router(websockets.router, tags=["WebSockets"])

# -------------------- SAFE BACKGROUND TASK --------------------
async def safe_monitoring():
    while True:
        try:
            await automated_monitoring_loop()
        except Exception as e:
            print(f"[ERROR] Monitoring crashed: {e}")
            await asyncio.sleep(5)

# -------------------- STARTUP --------------------
@app.on_event("startup")
async def startup_event():
    # -------- ROUTING & GRAPH INITIALIZATION --------
    print("[NEXUS] Initializing routing engine...")
    try:
        LogisticsAgent.load_graph()
        print("[OK] Routing graph initialized.")
    except Exception as e:
        print(f"[WARNING] Local routing graph failed to load: {e}")
        print("[INFO] System will fallback to OSRM API for road-aware navigation.")

    print("\n[NEXUS] Starting system components...\n")

    # -------- SECURITY CHECK --------
    if settings.SECRET_KEY == "CHANGE_ME_IN_ENV":
        print("\n⚠️  [SECURITY WARNING] SECRET_KEY is set to the default value!")
        print("   JWT tokens are signed with a publicly known key.")
        print("   Set a strong SECRET_KEY in your .env file before deploying.\n")

    # -------- DATABASE & SPATIAL CHECK --------
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            # Attempt to auto-init PostGIS if possible (requires superuser or specific perms)
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                conn.commit()
                print("[OK] PostGIS extension verified/created.")
            except Exception as e:
                print(f"[WARNING] Could not auto-initialize PostGIS: {e}")
        print("[OK] Database connection successful.")
    except Exception as e:
        print("\n[FATAL] Database connection failed!")
        print(f"Reason: {e}")
        print("Fix: Ensure PostgreSQL is running on port 5432.\n")
        raise RuntimeError("Database not available")

    # -------- ADMIN SELF-HEAL --------
    from database import SessionLocal
    from auth import get_password_hash, verify_password

    ADMIN_EMAIL = "rishirithin@gmail.com"
    ADMIN_PASSWORD = settings.ADMIN_PASSWORD

    print(f"[AUTH] Admin self-heal: checking user '{ADMIN_EMAIL}'...")
    print(f"[AUTH] ADMIN_PASSWORD env var is {'SET (non-default)' if ADMIN_PASSWORD != 'ChangeMe123' else 'DEFAULT — skipping self-heal to prevent accidental password reset'}")

    if ADMIN_PASSWORD == "ChangeMe123":
        print("[WARNING] ADMIN_PASSWORD is unset/default. Skipping self-heal. Set ADMIN_PASSWORD env var on Render.")
    else:
        db = SessionLocal()
        try:
            admin = db.query(models.User).filter(models.User.email == ADMIN_EMAIL).first()

            if not admin:
                print(f"[FIX] Admin '{ADMIN_EMAIL}' not found — creating now.")
                new_admin = models.User(
                    name="Admin",
                    email=ADMIN_EMAIL,
                    password_hash=get_password_hash(ADMIN_PASSWORD),
                    role=models.UserRole.ADMIN,
                    organization="NEXUS HQ"
                )
                db.add(new_admin)
                db.commit()
                print("[OK] Admin user created successfully.")

            else:
                print(f"[AUTH] Admin '{ADMIN_EMAIL}' exists. Verifying password hash...")
                password_ok = verify_password(ADMIN_PASSWORD, admin.password_hash)
                if not password_ok:
                    print(f"[FIX] Password mismatch detected for '{ADMIN_EMAIL}'. Resetting hash to match ADMIN_PASSWORD env var.")
                    admin.password_hash = get_password_hash(ADMIN_PASSWORD)
                    db.commit()
                    print("[OK] Admin password hash updated.")
                else:
                    print(f"[OK] Admin password hash is valid. No changes needed.")

        except Exception as e:
            print(f"[ERROR] Admin self-heal failed: {e}")
            import traceback
            traceback.print_exc()
        finally:
            db.close()

    # -------- START SAFE MONITORING --------
    asyncio.create_task(safe_monitoring())

    print("\n[NEXUS] System fully initialized and running.\n")
