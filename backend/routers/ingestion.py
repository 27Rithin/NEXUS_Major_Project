from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import datetime
from datetime import timedelta
import json
import logging
import random

from database import get_db
import models
from utils.spatial import create_point, create_linestring_from_tuples
from services.decision_engine import DecisionEngine
from services.social_agent import SocialMediaAgent
from services.vision_agent import VisionAnalysisAgent
from services.weather_agent import WeatherVerificationAgent
from services.logistics_agent import LogisticsAgent
from routers.websockets import manager
import auth

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)

class SOSRequest(BaseModel):
    lat: float
    lng: float
    description: Optional[str] = None
    device_id: Optional[str] = None

async def _process_event_impl(db: Session, event: models.DisasterEvent, nlp_score: float = 0.0, vision_score: float = 0.0, weather_score: float = 0.0, sensor_score: float = 0.0, source: str = "unknown"):
    """Refined Cross-Modal Processing Pipeline"""
    try:
        if event.location:
             weather_result = WeatherVerificationAgent.get_weather_data(event.latitude, event.longitude)
             weather_score = weather_result["weather_severity"]
    except Exception as e:
        logger.error(f"Weather check failed: {e}")
        
    decision = DecisionEngine.evaluate_priority(
        nlp_score=nlp_score,
        vision_score_normalized=vision_score,
        weather_score=weather_score,
        sensor_score=sensor_score,
        hours_since_update=0.0,
        category=event.category or "Unknown",
        source=source
    )
    
    event.priority_score = decision["priority_score"]
    event.confidence_score = decision["confidence_score"]
    
    if event.priority_score < 4.0:
        event.severity_level = "LOW"
    elif event.priority_score < 7.0:
        event.severity_level = "MEDIUM"
    elif event.priority_score < 9.0:
        event.severity_level = "HIGH"
    else:
        event.severity_level = "CRITICAL"

    if event.severity_level == "CRITICAL":
        event.status_message = "🚨 Emergency detected. Rescue units have been dispatched."
    elif event.severity_level in ["MEDIUM", "HIGH"]:
        event.status_message = "🟠 Situation under monitoring. Stay alert."
    else:
        event.status_message = "🟢 No immediate danger detected. You are safe."

    db.commit()
    db.refresh(event)

    # 🔴 Standardized Broadcast Payload (Fresh from DB)
    event_payload = {
        "id": str(event.id),
        "idempotency_key": str(event.id),
        "title": event.title or "Untitled Incident",
        "description": event.description or "",
        "category": event.category or "SOS",
        "location": {"lat": float(event.latitude), "lng": float(event.longitude)},
        "priority_score": float(event.priority_score or 0.0),
        "confidence_score": float(event.confidence_score or 0.0),
        "severity_level": event.severity_level,
        "status_message": event.status_message,
        "status": event.status.value,
        "created_at": event.created_at.isoformat()
    }
    await manager.broadcast(json.dumps({"type": "new_incident", "data": event_payload}))
    logger.info(f"📢 BROADCAST SENT [Process-Flow] for Event: {event.id}")

async def process_event(event_id: str, **kwargs):
    from database import SessionLocal
    db = SessionLocal()
    try:
        event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
        if event:
            await _process_event_impl(db, event, **kwargs)
    finally:
        db.close()

@router.post("/sos")
async def receive_sos(request: SOSRequest, db: Session = Depends(get_db)):
    """Receives direct SOS signals and performs immediate multi-modal verification."""
    logger.info(f"🛰️ SOS RECEIVED from Device: {request.device_id or 'UNKNOWN'} at [{request.lat}, {request.lng}]")
    weather_data = WeatherVerificationAgent.get_weather_data(request.lat, request.lng)
    
    decision = DecisionEngine.evaluate_priority(
        nlp_score=1.0,
        vision_score_normalized=0.0,
        weather_score=weather_data["weather_severity"],
        sensor_score=0.4,
        source="citizen_app"
    )

    new_event = models.DisasterEvent(
        title=f"Direct SOS: {request.device_id}" if request.device_id else "Direct SOS Alert",
        description=request.description or "Emergency signal from citizen app.",
        category="SOS",
        location=create_point(request.lat, request.lng),
        priority_score=decision["priority_score"],
        confidence_score=decision["confidence_score"],
        severity_level=decision["severity_level"],
        status=models.EventStatus.PENDING,
        is_verified=True
    )
    
    db.add(new_event)
    db.flush()
    logger.info(f"✅ EVENT CREATED: {new_event.id} | Status: {new_event.status.value}")

    # 1. Fallback Logic: Default to Ambulance if category is unknown
    dispatch_info = None
    if decision["severity_level"] == "CRITICAL":
        category_map = {
            "FIRE": models.UnitType.FIRE_ENGINE,
            "FLOOD": models.UnitType.BOAT,
            "MEDICAL": models.UnitType.AMBULANCE,
            "SOS": models.UnitType.AMBULANCE
        }
        # Fallback to AMBULANCE if missing/invalid
        target_unit_type = category_map.get((new_event.category or "SOS").upper(), models.UnitType.AMBULANCE)

        available_unit = db.query(models.RescueUnit).filter(
            models.RescueUnit.status == models.RescueUnitStatus.AVAILABLE,
            models.RescueUnit.unit_type == target_unit_type
        ).first()

        if available_unit:
            route_plan = LogisticsAgent.calculate_optimal_route(
                db=db, end=(request.lat, request.lng), 
                unit_type=target_unit_type.value
            )
            
            db_route = models.Route(
                event_id=new_event.id,
                start_location=create_point(route_plan["start_coords"]["lat"], route_plan["start_coords"]["lng"]),
                end_location=create_point(request.lat, request.lng),
                path_geometry=create_linestring_from_tuples([(p["lat"], p["lng"]) for p in route_plan["path_geometry"]]),
                estimated_time_mins=route_plan["estimated_time_mins"]
            )
            db.add(db_route)
            new_event.status = models.EventStatus.IN_PROGRESS
            dispatch_info = {"unit_callsign": available_unit.callsign, "eta": route_plan["estimated_time_mins"]}

    # 🔴 COMMIT → REFRESH → BROADCAST Lifecycle
    db.commit()
    db.refresh(new_event)
    logger.info(f"✅ EVENT CREATED: {new_event.id} | Status: {new_event.status.value}")

    event_payload = {
        "id": str(new_event.id),
        "idempotency_key": str(new_event.id),
        "title": new_event.title or "SOS Alert",
        "description": new_event.description or "",
        "location": {"lat": float(request.lat), "lng": float(request.lng)},
        "category": new_event.category,
        "priority_score": float(new_event.priority_score or 0.0),
        "confidence_score": float(new_event.confidence_score or 0.0),
        "severity_level": new_event.severity_level,
        "status_message": f"🚨 SOS: {new_event.severity_level} incident reported",
        "status": new_event.status.value,
        "created_at": new_event.created_at.isoformat()
    }

    await manager.broadcast(json.dumps({"type": "new_incident", "data": event_payload}))
    logger.info(f"📢 BROADCAST SENT [SOS-Flow] for Event: {new_event.id}")

    return {
        "message": "Rescue Request Received",
        "event_id": str(new_event.id),
        "severity": new_event.severity_level,
        "dispatch_info": dispatch_info
    }

@router.post("/simulate")
async def simulate_events(background_tasks: BackgroundTasks, count: int = 10, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin required.")
        
    for _ in range(min(count, 20)):
        lat, lng = random.uniform(13.5, 13.7), random.uniform(79.3, 79.5)
        new_event = models.DisasterEvent(
            title="Simulated Incident",
            category=random.choice(["Fire", "Flood", "Medical"]),
            location=create_point(lat, lng),
            status=models.EventStatus.PENDING
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        background_tasks.add_task(process_event, str(new_event.id), nlp_score=random.uniform(0.4, 0.9))
        
    return {"message": f"Queued {count} simulations."}
