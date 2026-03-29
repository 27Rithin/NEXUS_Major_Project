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
from geoalchemy2.shape import to_shape

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)

class SOSRequest(BaseModel):
    lat: float
    lng: float
    description: Optional[str] = None
    device_id: Optional[str] = None

class LegacyCallRequest(BaseModel):
    transcript: str
    lat: Optional[float] = None
    lng: Optional[float] = None

class SensorRequest(BaseModel):
    sensor_type: str
    lat: float
    lng: float
    value: float

async def process_event(event_id: str, nlp_score: float = 0.0, vision_score: float = 0.0, weather_score: float = 0.0, sensor_score: float = 0.0, source: str = "unknown"):
    from database import SessionLocal
    db = SessionLocal()
    try:
        event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
        if event:
            await _process_event_impl(db, event, nlp_score, vision_score, weather_score, sensor_score, source)
    finally:
        db.close()

async def _process_event_impl(db: Session, event: models.DisasterEvent, nlp_score: float = 0.0, vision_score: float = 0.0, weather_score: float = 0.0, sensor_score: float = 0.0, source: str = "unknown"):
    """Refined Cross-Modal Processing Pipeline"""
    # 1. Weather Verification (Always query if we have lat/lng)
    try:
        if event.location:
             weather_result = WeatherVerificationAgent.get_weather_data(event.latitude, event.longitude)
             weather_score = weather_result["weather_severity"]
    except Exception as e:
        logger.error(f"Weather check failed: {e}")
        
    # 2. Re-Evaluate Priority with all modalities
    # For temporal decay, since it's fresh, hours_since_update = 0
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

    # Status Message Generation
    if event.severity_level == "CRITICAL":
        event.status_message = "🚨 Emergency detected. Rescue units have been dispatched."
    elif event.severity_level == "MEDIUM" or event.severity_level == "HIGH":
        event.status_message = "🟠 Situation under monitoring. Stay alert. Dispatch will be triggered if conditions worsen."
    else:
        event.status_message = "🟢 No immediate danger detected. You are safe at your location."

    if decision["trigger_logistics"]:
        # Extract target coordinates dynamically from event
        target_lat, target_lng = event.latitude, event.longitude
        
        if not target_lat or not target_lng:
             logger.error("Cannot trigger logistics: Missing event coordinates")
             return

        route_plan = LogisticsAgent.calculate_optimal_route(
            db=db,
            end=(target_lat, target_lng),
            blocked_areas=[],
            unit_type="AMBULANCE"
        )
        start_point = route_plan["start_coords"]
        
        from utils.spatial import create_linestring
        db_route = models.Route(
            event_id=event.id,
            start_location=create_point(start_point["lat"], start_point["lng"]),
            end_location=create_point(target_lat, target_lng),
            path_geometry=create_linestring(route_plan["path_geometry"]),
            estimated_time_mins=route_plan["estimated_time_mins"]
        )
        db.add(db_route)

    db.commit()
    db.refresh(event)

    point = {"lat": event.latitude, "lng": event.longitude}

    # Broadcast to dashboard
    event_payload = {
        "id": str(event.id),
        "title": event.title or "Untitled Incident",
        "description": event.description or "No description provided",
        "category": event.category or "Default",
        "location": {"lat": float(point["lat"]), "lng": float(point["lng"])} if point["lat"] else {"lat": 13.6288, "lng": 79.4192},
        "priority_score": float(event.priority_score or 0.0),
        "confidence_score": float(event.confidence_score or 0.0),
        "severity_level": event.severity_level or "LOW",
        "status_message": event.status_message or "Situation under evaluation.",
        "status": event.status.value if hasattr(event.status, 'value') else str(event.status),
        "created_at": event.created_at.isoformat() if event.created_at else datetime.datetime.utcnow().isoformat(),
        "last_updated_decay": 0
    }
    
    try:
        await manager.broadcast(json.dumps({"type": "new_incident", "data": event_payload}))
    except Exception as e:
        logger.error(f"WebSocket broadcast failed for event {event_id}: {e}")


# Simple In-Memory Rate Limiter for SOS spam protection
sos_rate_limit_cache = {} # device_id -> last_timestamp

@router.post("/sos")
async def receive_sos(request: SOSRequest, db: Session = Depends(get_db)):
    """Receives direct SOS signals and performs immediate multi-modal verification."""
    # 1. Security: Rate Limiting (Requirement: Max 3 SOS/min per device)
    now = datetime.datetime.utcnow()
    device_id = request.device_id or "UNKNOWN"
    
    if device_id != "UNKNOWN" or True: # Apply to all, even unknown (identifying by request.client.host if possible)
        if device_id in sos_rate_limit_cache:
            # Clean up old timestamps (older than 1 minute)
            sos_rate_limit_cache[device_id] = [ts for ts in sos_rate_limit_cache[device_id] if now - ts < timedelta(minutes=1)]
            
            # Relaxed limit: 10 SOS per minute (Requirement: Max 10 SOS/min per device)
            if len(sos_rate_limit_cache[device_id]) >= 10:
                logger.warning(f"Rate limit exceeded for device {device_id}")
                raise HTTPException(status_code=429, detail="Emergency rate limit exceeded. Please wait 1 minute.. Queued locally.")
            
            sos_rate_limit_cache[device_id].append(now)
        else:
            sos_rate_limit_cache[device_id] = [now]

    # 2. Verification: Crowd Consensus (Multi-post requirement)
    crowd_confidence = SocialMediaAgent.verify_crowd_consensus(db, request.lat, request.lng)

    # 2. Verification: Weather
    weather_data = WeatherVerificationAgent.get_weather_data(request.lat, request.lng)
    
    # 3. Verification: Mock Sensors & Historical Risk
    sensor_score = random.uniform(0.1, 0.6) # Simulated sensor data
    historical_risk = 0.3 # Mock historical risk for this area

    # 4. Multi-Modal Reasoning (Synchronous for immediate feedback)
    decision = DecisionEngine.evaluate_priority(
        nlp_score=1.0, # Direct SOS is high intent
        vision_score_normalized=0.0, # No vision yet
        weather_score=weather_data["weather_severity"],
        sensor_score=sensor_score,
        nearby_reports_score=crowd_confidence,
        historical_risk_score=historical_risk,
        source="citizen_app"
    )

    # 5. Create Event with spatial safety
    title = f"Direct SOS: {request.device_id}" if request.device_id else "Direct SOS Alert"
    try:
        location_geom = create_point(request.lat, request.lng)
    except Exception as e:
        logger.error(f"Spatial indexing failed for SOS: {e}")
        raise HTTPException(status_code=500, detail="Database spatial configuration error. Please contact NEXUS Support.")

    new_event = models.DisasterEvent(
        title=title,
        description=request.description or "Emergency signal from citizen app.",
        category="SOS",
        location=location_geom,
        priority_score=decision["priority_score"],
        confidence_score=decision["confidence_score"],
        severity_level=decision["severity_level"],
        status=models.EventStatus.PENDING,
        is_verified=decision["confidence_score"] >= 0.5
    )
    
    # Status Message Generation for SOS
    if decision["severity_level"] == "CRITICAL":
        new_event.status_message = "🚨 Emergency detected. Rescue units have been dispatched."
    elif decision["severity_level"] == "MEDIUM" or decision["severity_level"] == "HIGH":
        new_event.status_message = "🟠 Situation under monitoring. Stay alert."
    else:
        new_event.status_message = "🟢 No immediate danger detected. You are safe."
        
    db.add(new_event)
    db.flush()

    # 6. Resource-Aware Auto-Dispatch (For CRITICAL)
    dispatch_info = None
    if decision["severity_level"] == "CRITICAL":
        # Check unit availability
        available_unit = db.query(models.RescueUnit).filter(
            models.RescueUnit.status == models.RescueUnitStatus.AVAILABLE,
            models.RescueUnit.unit_type == models.UnitType.AMBULANCE
        ).first()

        if available_unit:
            # Dispatch
            route_plan = LogisticsAgent.calculate_optimal_route(
                db=db,
                end=(request.lat, request.lng),
                blocked_areas=[],
                unit_type="AMBULANCE"
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
            
            # Create Dispatch Log
            dispatch_log = models.DispatchLog(
                event_id=new_event.id,
                unit_type=models.UnitType.AMBULANCE,
                notes=f"Auto-dispatched {available_unit.callsign} due to CRITICAL SOS."
            )
            db.add(dispatch_log)
        else:
            # Queue
            new_event.description += "\n[QUEUED]: No units available for immediate dispatch."

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"SOS Persistence Failed: {e}")
        raise HTTPException(status_code=500, detail="Persistence error. SOS recorded in server logs but DB commit failed.")

    # 7. Broadcast update
    event_payload = {
        "id": str(new_event.id),
        "location": {"lat": float(request.lat), "lng": float(request.lng)},
        "category": "SOS",
        "severity_level": new_event.severity_level or "LOW",
        "status_message": new_event.status_message or "Situation under evaluation.",
        "priority_score": float(new_event.priority_score or 0.0),
        "confidence_score": float(new_event.confidence_score or 0.0),
        "created_at": new_event.created_at.isoformat() if new_event.created_at else datetime.datetime.utcnow().isoformat(),
        # Keeping title/description for UI display compatibility
        "title": new_event.title or "SOS Alert",
        "description": new_event.description or "Emergency signal received.",
        "status": new_event.status.value if hasattr(new_event.status, 'value') else str(new_event.status),
    }
    await manager.broadcast(json.dumps({"type": "new_incident", "data": event_payload}))

    return {
        "message": "Rescue Request Received",
        "event_id": str(new_event.id),
        "severity": decision["severity_level"],
        "confidence": decision["confidence_score"],
        "location": {"lat": request.lat, "lng": request.lng},
        "color": decision["color"],
        "status_message": decision["status_message"],
        "dispatch_info": dispatch_info
    }

@router.post("/legacy-call")
async def receive_legacy_call(request: LegacyCallRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Simulates 112/108 Speech-to-Text ingest."""
    analysis = SocialMediaAgent.analyze_text(request.transcript)
    
    if analysis["is_actionable"]:
        # Use provided coordinates or default to Tirupati center
        event_lat = request.lat if request.lat is not None else 13.6288
        event_lng = request.lng if request.lng is not None else 79.4192
        
        new_event = models.DisasterEvent(
            title=f"Emergency Call: {analysis['category']}",
            description=request.transcript,
            category=analysis['category'],
            location=create_point(event_lat, event_lng),
            social_nlp_score=analysis['nlp_score']
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        
        background_tasks.add_task(process_event, str(new_event.id), nlp_score=analysis['nlp_score'], source="legacy_call")
        return {"message": "Call ingested and actioned", "event_id": str(new_event.id)}
    
    return {"message": "Call logged, non-actionable."}

@router.post("/sensor")
async def receive_sensor_data(request: SensorRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Receives IoT Sensor Signals."""
    
    # Simple threshold logic:
    sensor_score = 0.0
    category = "Sensor Anomaly"
    
    if request.sensor_type == "water_level" and request.value > 4.0:
        sensor_score = 0.9
        category = "Flood Warning"
    elif request.sensor_type == "power_outage":
        sensor_score = 0.6
        category = "Infrastructure Failure"
        
    if sensor_score > 0.5:
        new_event = models.DisasterEvent(
            title=f"IoT Trigger: {category}",
            description=f"Automated sensor {request.sensor_type} hit value {request.value}",
            category=category,
            location=create_point(request.lat, request.lng)
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        
        background_tasks.add_task(process_event, str(new_event.id), sensor_score=sensor_score, source="sensor")
        return {"message": "Sensor threshold broken, incident created", "event_id": str(new_event.id)}
    
    return {"message": "Sensor read, normal range."} 

@router.post("/simulate")
async def simulate_events(
    background_tasks: BackgroundTasks, 
    count: int = 10, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Admin endpoint to simulate massive simultaneous events."""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized. Admin role required.")
        
    if count > 50:
        raise HTTPException(status_code=400, detail="Cannot simulate more than 50 events at once.")

    categories = [
        "Flood", "Earthquake", "Urban Fire", 
        "Infrastructure Failure", "Medical Emergency", 
        "Traffic Collision", "Chemical Spill", 
        "Civil Unrest", "Severe Storm"
    ]

    for _ in range(count):
        cat = random.choice(categories)
        lat = random.uniform(13.50, 13.75)
        lng = random.uniform(79.30, 79.55)
        
        new_event = models.DisasterEvent(
            title=f"Simulated: {cat}",
            description=f"Auto-generated mock event for testing pipeline. Coordinates: {lat:.4f}, {lng:.4f}",
            category=cat,
            location=create_point(lat, lng),
            status=models.EventStatus.PENDING,
            is_verified=False
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        
        # Simulate different sensors picking up the event
        nlp_score = random.uniform(0.3, 0.9)
        vision_score = random.uniform(0.0, 0.8)
        weather_score = random.uniform(0.0, 0.6)
        sensor_score = random.uniform(0.0, 0.9)
        
        background_tasks.add_task(
            process_event, 
            str(new_event.id), 
            nlp_score=nlp_score, 
            vision_score=vision_score, 
            weather_score=weather_score, 
            sensor_score=sensor_score, 
            source="social"
        )
        
    return {"message": f"Successfully queued {count} simulated events.", "status": "processing"}
