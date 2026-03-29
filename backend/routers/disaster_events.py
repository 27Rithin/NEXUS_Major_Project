from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from uuid import UUID
from pydantic import BaseModel

class FieldUpdateRequest(BaseModel):
    status: str
    field_severity: float = 0.0
    notes: Optional[str] = None

class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float

from database import get_db
import models
import schemas
import auth
from services.weather_agent import WeatherVerificationAgent
from services.decision_engine import DecisionEngine
from services.logistics_agent import LogisticsAgent
from services.vision_agent import VisionAnalysisAgent
from datetime import datetime, timezone
from utils.spatial import create_point, create_linestring
import logging
from geoalchemy2.shape import to_shape

import os
logger = logging.getLogger(__name__)

DEFAULT_LAT = float(os.getenv("DEFAULT_LAT", 13.6288))
DEFAULT_LNG = float(os.getenv("DEFAULT_LNG", 79.4192))

router = APIRouter()

@router.get("/", response_model=List[schemas.EventResponse])
def get_all_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    events = db.query(models.DisasterEvent).offset(skip).limit(limit).all()
    # Serialize location for Pydantic
    serialized_events = []
    for event in events:
        # Use to_shape for safe and efficient coordinate extraction
        point = to_shape(event.location)
        
        event_dict = {
            "id": event.id,
            "title": event.title or "Untitled Incident",
            "description": event.description or "No description provided",
            "category": event.category or "Default",
            "location": {"lng": float(point.x), "lat": float(point.y)} if point else {"lat": DEFAULT_LAT, "lng": DEFAULT_LNG},
            "social_nlp_score": float(event.social_nlp_score or 0.0),
            "priority_score": float(event.priority_score or 0.0),
            "confidence_score": float(event.confidence_score or 0.0),
            "severity_level": event.severity_level or "LOW",
            "status": event.status.value if hasattr(event.status, 'value') else str(event.status),
            "is_verified": event.is_verified,
            "xai_breakdown": event.xai_breakdown or {},
            "created_at": event.created_at,
            "updated_at": event.updated_at
        }
        serialized_events.append(event_dict)
    return serialized_events

@router.get("/{event_id}", response_model=schemas.EventResponse)
def get_event_by_id(event_id: UUID, db: Session = Depends(get_db)):
    event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    point = to_shape(event.location)
    return {
        "id": event.id,
        "title": event.title or "Untitled Incident",
        "description": event.description or "",
        "category": event.category or "Default",
        "location": {"lng": float(point.x), "lat": float(point.y)} if point else {"lat": DEFAULT_LAT, "lng": DEFAULT_LNG},
        "social_nlp_score": float(event.social_nlp_score or 0.0),
        "priority_score": float(event.priority_score or 0.0),
        "confidence_score": float(event.confidence_score or 0.0),
        "severity_level": event.severity_level or "LOW",
        "status": event.status.value if hasattr(event.status, 'value') else str(event.status),
        "is_verified": event.is_verified,
        "xai_breakdown": event.xai_breakdown or {},
        "created_at": event.created_at,
        "updated_at": event.updated_at
    }

@router.get("/{event_id}/route")
def get_event_route(event_id: UUID, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Fetches the route geometry for an event, if any."""
    route = db.query(models.Route).filter(models.Route.event_id == event_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="No route found for this event")
        
    # Use to_shape to extract points from path_geometry without raw SQL
    shape = to_shape(route.path_geometry)
    path = [{"lat": float(y), "lng": float(x)} for x, y in shape.coords]
    
    return {
        "event_id": event_id,
        "estimated_time_mins": route.estimated_time_mins,
        "path_geometry": path
    }

@router.post("/{event_id}/cross-modal-trigger")
def trigger_cross_modal_reasoning(event_id: UUID, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Triggers the Cross-Modal Decision Engine for a given event.
    Pulls NLP score from social, vision severity, and fetches current weather to calculate priority.
    """
    event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # Get or Generate Vision Score
    vision_entry = db.query(models.VisionAnalysis).filter(models.VisionAnalysis.event_id == event_id).order_by(models.VisionAnalysis.analyzed_at.desc()).first()
    if vision_entry:
        vision_score = vision_entry.severity_score / 10.0
    else:
        # Simulate Vision Agent Analysis on the fly!
        category_lower = event.category.lower() if event.category else "unknown"
        keyword = "flood" if "flood" in category_lower or "water" in category_lower else ("fire" if "fire" in category_lower or "smoke" in category_lower else "earthquake")
        img_url = f"https://example.com/mock_{keyword}.jpg"
        
        vision_result = VisionAnalysisAgent.analyze_image(img_url)
        
        new_vision = models.VisionAnalysis(
            event_id=event.id,
            image_url=img_url,
            detected_objects=vision_result["detected_objects"],
            severity_score=vision_result["severity_score"]
        )
        db.add(new_vision)
        vision_score = vision_result.get("normalized_score", vision_result["severity_score"] / 10.0)

    # Get Point Lat/Lng safely
    point = to_shape(event.location)
    
    # Get Weather context
    weather_data = WeatherVerificationAgent.get_weather_data(lat=point.y, lng=point.x)
    
    # Save Weather Data
    new_weather = models.WeatherData(
        event_id=event.id,
        temperature=weather_data["temperature"],
        wind_speed=weather_data["wind_speed"],
        precipitation=weather_data["precipitation"],
        weather_severity=weather_data["weather_severity"]
    )
    db.add(new_weather)
    
    # Evaluate Priority using Decision Engine
    decision = DecisionEngine.evaluate_priority(
        nlp_score=event.social_nlp_score or 0.0,
        vision_score_normalized=vision_score,
        weather_score=weather_data["weather_severity"],
        category=event.category or "Unknown",
        source="social" if event.social_nlp_score else "unknown"
    )
    
    # Update Event
    event.priority_score = decision["priority_score"]
    event.confidence_score = decision["confidence_score"]
    event.severity_level = decision["severity_level"]
    event.status_message = decision["status_message"]
    event.is_verified = decision["trigger_logistics"]
    event.xai_breakdown = decision["xai_breakdown"]
    
    result = {
        "event_id": event.id,
        "new_priority_score": decision["priority_score"],
        "breakdown": decision["breakdown"],
        "route_triggered": decision["trigger_logistics"]
    }

    # If triggered, run Logistics Agent
    if decision["trigger_logistics"]:
        result["logistics"] = {"message": "Pending deployment authorization"}
        
    db.commit()
    return result

@router.post("/{event_id}/dispatch", response_model=schemas.DispatchLogResponse)
async def dispatch_unit(
    event_id: UUID, 
    dispatch_data: schemas.DispatchLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Dispatch a rescue unit (Drone, Boat, Ambulance) to an incident.
    Only authenticated users can trigger this.
    Generates Logistics route using final (or overridden) coordinates.
    """
    event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # Validation & Precedence Logic
    dest_lat = None
    dest_lng = None
    
    # 1. Check if Override is in Payload
    if dispatch_data.override_lat is not None and dispatch_data.override_lng is not None:
        if not (-90 <= dispatch_data.override_lat <= 90) or not (-180 <= dispatch_data.override_lng <= 180):
             raise HTTPException(status_code=400, detail="Invalid override coordinate bounds")
        event.override_lat = dispatch_data.override_lat
        event.override_lng = dispatch_data.override_lng
        event.is_location_overridden = True
        event.override_timestamp = datetime.now(timezone.utc)
        dest_lat = dispatch_data.override_lat
        dest_lng = dispatch_data.override_lng
    
    # 2. Check if DB already has override (Fallback if UI didn't resend)
    elif event.is_location_overridden:
        dest_lat = event.override_lat
        dest_lng = event.override_lng
        
    # 3. Default back to auto-detected geometry
    else:
        point = to_shape(event.location)
        dest_lat = point.y
        dest_lng = point.x

    route_plan = LogisticsAgent.calculate_optimal_route(
        db=db,
        end=(dest_lat, dest_lng),
        blocked_areas=[],
        unit_type=dispatch_data.unit_type
    )
    
    start_point = route_plan["start_coords"]
    
    # Create route in DB
    new_route = models.Route(
        event_id=event.id,
        start_location=create_point(start_point["lat"], start_point["lng"]),
        end_location=create_point(dest_lat, dest_lng),
        path_geometry=create_linestring(route_plan["path_geometry"]),
        estimated_time_mins=route_plan["estimated_time_mins"]
    )
    db.add(new_route)

    # Update event status
    event.status = models.EventStatus.IN_PROGRESS
    
    # Create dispatch log
    # We embed the unit_id in the notes so we can parse it and free the unit later
    unit_id_str = f"[UNIT_ID: {route_plan['unit_id']}] " if route_plan.get("unit_id") else ""
    dispatch_log = models.DispatchLog(
        event_id=event_id,
        user_id=current_user.id,
        unit_type=dispatch_data.unit_type,
        notes=unit_id_str + (dispatch_data.notes or "")
    )
    
    db.add(dispatch_log)
    
    # Single Transactional Commit for Safety
    db.commit()
    db.refresh(dispatch_log)
    
    # High-Performance ETA: Cap at 9.9 minutes
    dispatch_eta = round(min(route_plan["estimated_time_mins"], 9.9), 1)

    # Get unit emoji for broadcast
    ut = dispatch_data.unit_type.upper()
    if "FIRE" in ut or "ENGINE" in ut:
        d_emoji = "\U0001F692"
    elif "DRONE" in ut or "SCOUT" in ut:
        d_emoji = "\U0001F6F8"
    elif "BOAT" in ut:
        d_emoji = "\U0001F6A4"
    else:
        d_emoji = "\U0001F691"

    # Broadcast Live Dispatch to Citizens/Dashboards
    from routers.websockets import manager
    import json
    await manager.broadcast(json.dumps({
        "type": "UNIT_DISPATCHED",
        "data": {
            "event_id": str(event_id),
            "unit_type": dispatch_data.unit_type,
            "unit_icon": d_emoji,
            "eta_mins": dispatch_eta,
            "status": f"{d_emoji} Rescue unit dispatched — ETA {dispatch_eta} min"
        }
    }))
    
    return dispatch_log

import re
@router.post("/{event_id}/field-update")
async def process_field_update(
    event_id: UUID, 
    update: FieldUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Responder updates an ongoing event with field reports, potentially altering its severity or resolving it."""
    event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    try:
        event.status = models.EventStatus(update.status)
    except ValueError:
        pass # Handle invalid status string gracefully or ignore
    
    # Process field enhanced priority if still active and field_severity provided
    if event.status != models.EventStatus.RESOLVED and update.field_severity > 0:
        # get weather context
        loc_point = to_shape(event.location)
        weather = db.query(models.WeatherData).filter(models.WeatherData.event_id == event.id).order_by(models.WeatherData.recorded_at.desc()).first()
        weather_score = weather.weather_severity if weather else 0.0
        
        vision = db.query(models.VisionAnalysis).filter(models.VisionAnalysis.event_id == event.id).order_by(models.VisionAnalysis.analyzed_at.desc()).first()
        vision_score = vision.severity_score / 10.0 if vision else 0.0
        
        decision = DecisionEngine.evaluate_priority(
            nlp_score=event.social_nlp_score or 0.0,
            vision_score_normalized=vision_score,
            weather_score=weather_score,
            sensor_score=max(0.0, update.field_severity), # Field severity treated as a sensor override
            category=event.category or "Unknown",
            source="unknown"
        )
        
        event.priority_score = decision["priority_score"]
        
        if event.priority_score >= 9.0: event.severity_level = "CRITICAL"
        elif event.priority_score >= 7.0: event.severity_level = "HIGH"
        elif event.priority_score >= 4.0: event.severity_level = "MEDIUM"
        else: event.severity_level = "LOW"
        
    # If resolved, free up the units
    if event.status == models.EventStatus.RESOLVED:
        logs = db.query(models.DispatchLog).filter(models.DispatchLog.event_id == event.id).all()
        for log in logs:
            if log.notes and "[UNIT_ID:" in log.notes:
                match = re.search(r'\[UNIT_ID:\s*([^]]+)\]', log.notes)
                if match:
                    unit_id_str = match.group(1).strip()
                    if unit_id_str and unit_id_str != "None":
                        unit = db.query(models.RescueUnit).filter(models.RescueUnit.id == unit_id_str).first()
                        if unit:
                            unit.status = models.RescueUnitStatus.AVAILABLE  # Reset back to pool
                            db.add(unit)

    # Optional: Log the notes in description
    if update.notes:
        event.description = f"{event.description}\n\n[FIELD RECORD]: {update.notes}"

    db.commit()
    db.refresh(event)
    
    # Broadcast
    from routers.websockets import manager
    import json
    event_payload = {
        "id": str(event.id),
        "status": event.status.value,
        "priority_score": event.priority_score,
        "severity_level": event.severity_level
    }
    await manager.broadcast(json.dumps({"type": "event_updated", "data": event_payload}))
    
    return {"message": "Field update processed.", "event": event_payload}

@router.post("/{event_id}/suggest-dispatch", response_model=schemas.SuggestDispatchResponse)
async def suggest_dispatch_route(
    event_id: UUID,
    suggest_data: schemas.SuggestDispatchCreate,
    db: Session = Depends(get_db)
):
    """
    Simulates a dispatch to provide route visualization without making changes.
    Returns waypoints and estimated arrival time.
    Broadcasts a UNIT_DISPATCHED event to all connected clients (including Citizen App).
    """
    # Verify event exists
    event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    try:
        route_plan = LogisticsAgent.calculate_optimal_route(
            db=db,
            end=(suggest_data.dest_lat, suggest_data.dest_lng),
            unit_type=suggest_data.unit_type,
            preview=True
        )
    except Exception as e:
        logger.error(f"Routing suggestion failed for event {event_id}: {e}")
        raise HTTPException(status_code=400, detail=f"Routing service unavailable: {str(e)}")
    
    # High-Performance ETA: Cap at 9.9 minutes for optimized response grid
    raw_eta = route_plan["estimated_time_mins"]
    capped_eta = round(min(raw_eta, 9.9), 1)

    # Get unit emoji for the broadcast
    unit_type_str = suggest_data.unit_type.upper()
    if "FIRE" in unit_type_str or "ENGINE" in unit_type_str:
        unit_emoji = "\U0001F692"  # 🚒
    elif "DRONE" in unit_type_str or "SCOUT" in unit_type_str:
        unit_emoji = "\U0001F6F8"  # 🛸
    elif "BOAT" in unit_type_str:
        unit_emoji = "\U0001F6A4"  # 🚤
    else:
        unit_emoji = "\U0001F691"  # 🚑

    # Broadcast Suggested Dispatch to ALL connected clients (Citizen App + Dashboard)
    from routers.websockets import manager
    import json
    await manager.broadcast(json.dumps({
        "type": "UNIT_DISPATCHED",
        "data": {
            "event_id": str(event_id),
            "unit_type": suggest_data.unit_type,
            "unit_icon": unit_emoji,
            "eta_mins": capped_eta,
            "status": f"{unit_emoji} Rescue details are on the way — ETA {capped_eta} min"
        }
    }))
    logger.info(f"[BROADCAST] UNIT_DISPATCHED sent for event {event_id} — {suggest_data.unit_type} ETA {capped_eta}m")

    return {
        "route_waypoints": route_plan["path_geometry"],
        "unit_current_position": route_plan["start_coords"],
        "estimated_arrival_seconds": int(capped_eta * 60),
        "unit_type": suggest_data.unit_type.lower()
    }

@router.patch("/{event_id}/location")
async def update_event_location(
    event_id: UUID, 
    update: LocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Manually overrides an incident's location. 
    Typically triggered by a dispatcher dragging a marker on the map.
    """
    event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # Update location
    event.location = create_point(update.lat, update.lng)
    event.is_location_overridden = True
    event.override_lat = update.lat
    event.override_lng = update.lng
    event.override_timestamp = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(event)
    
    # Broadcast the move to all connected dashboards via WebSocket
    from routers.websockets import manager
    import json
    await manager.broadcast(json.dumps({
        "type": "event_moved",
        "data": {
            "id": str(event.id),
            "location": {"lat": update.lat, "lng": update.lng}
        }
    }))
    
    return {"message": "Location updated successfully", "id": event.id}
