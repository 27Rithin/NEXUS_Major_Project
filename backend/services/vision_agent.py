import random
import logging
from typing import Dict, Any, List, Optional
from config import settings
import models
from database import SessionLocal
from sqlalchemy.orm import Session
import uuid

logger = logging.getLogger(__name__)

class VisionAnalysisAgent:
    """
    Simulates a Vision Analysis pipeline.
    Now supports actual YOLOv5n lazy-loaded inference if enabled.
    """
    _model = None
    _model_loaded = False

    @classmethod
    def _get_model(cls) -> Optional[Any]:
        if not settings.ENABLE_VISION_AI:
            return None
            
        if not cls._model_loaded:
            try:
                import torch
                logger.info("Lazy loading YOLOv5n model for VisionAnalysisAgent...")
                cls._model = torch.hub.load('ultralytics/yolov5', 'yolov5n', pretrained=True, device='cpu')
            except Exception as e:
                logger.error(f"Failed to load YOLOv5 model: {e}. Falling back to mock vision logic.")
                cls._model = None
            finally:
                cls._model_loaded = True
        return cls._model

    @classmethod
    def analyze_image(cls, image_url: str) -> Dict[str, Any]:
        """Synchronous analysis core logic."""
        model = cls._get_model()
        url_lower = image_url.lower()
        detected_objects: List[str] = []
        severity_score = 1.0

        if model:
            try:
                results = model(image_url)
                df = results.pandas().xyxy[0]
                detected_objects = df['name'].unique().tolist()
                high_risk = ["fire", "car", "truck", "person", "boat", "bus", "train", "airplane"] 
                matched = [obj for obj in detected_objects if obj in high_risk]
                if matched:
                    severity_score = min(10.0, 5.0 + (len(matched) * 1.5))
                else:
                    severity_score = random.uniform(3.0, 6.0)
            except Exception as e:
                logger.error(f"Inference failed: {e}. Falling back to mock.")
                model = None

        if not model:
            if "flood" in url_lower or "water" in url_lower:
                detected_objects = ["flood_water", "stranded_vehicle", "human_in_water"]
                severity_score = random.uniform(7.0, 9.5)
            elif "fire" in url_lower or "smoke" in url_lower:
                detected_objects = ["fire", "smoke_plume", "collapsed_structure"]
                severity_score = random.uniform(8.0, 10.0)
            else:
                detected_objects = ["debris", "damaged_road"]
                severity_score = random.uniform(3.0, 7.0)

        return {
            "detected_objects": detected_objects,
            "severity_score": round(severity_score, 2),
            "normalized_score": round(severity_score / 10.0, 2)
        }

async def analyze_image_job(ctx, incident_id: str, image_url: str):
    """
    ARQ Job: Asynchronously process an image and update the incident.
    """
    logger.info(f"Vision job started for incident {incident_id}...")
    db: Session = SessionLocal()
    try:
        incident = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == incident_id).first()
        if not incident:
            logger.error(f"Incident {incident_id} not found.")
            return

        incident.vision_status = "PROCESSING"
        db.commit()

        # Perform analysis (Mock/YOLO)
        result = VisionAnalysisAgent.analyze_image(image_url)
        
        # Save VisionAnalysis record
        vision_db = models.VisionAnalysis(
            event_id=incident.id,
            image_url=image_url,
            detected_objects=result["detected_objects"],
            severity_score=result["severity_score"]
        )
        db.add(vision_db)

        # Update Incident
        incident.vision_status = "COMPLETE"
        
        # Trigger Decision Re-evaluation (simplified)
        # In a real app, we'd call DecisionEngine.evaluate_priority again
        from services.decision_engine import DecisionEngine
        # We need weather and nlp scores from the original incident/records
        weather_data = db.query(models.WeatherData).filter(models.WeatherData.event_id == incident.id).first()
        
        new_decision = DecisionEngine.evaluate_priority(
            nlp_score=incident.social_nlp_score or 0.0,
            vision_score_normalized=result["normalized_score"],
            weather_score=weather_data.weather_severity if weather_data else 0.0,
            category=incident.category,
            source="social",
            incident_id=str(incident.id)
        )

        # Update scores and log
        incident.priority_score = new_decision["priority_score"]
        incident.confidence_score = new_decision["confidence_score"]
        incident.severity_level = new_decision["severity_level"]
        incident.status_message = new_decision["status_message"]
        
        # Append to log
        new_log = list(incident.decision_log)
        log_entry = new_decision["log_entry"]
        log_entry["trigger"] = "vision_update"
        new_log.append(log_entry)
        incident.decision_log = new_log

        # Trigger Logistics if vision pushed it over the edge
        if new_decision["trigger_logistics"] and incident.status == models.EventStatus.PENDING:
            from services.logistics_agent import LogisticsAgent
            from utils.spatial import create_point, create_linestring_from_tuples
            
            lat = incident.latitude
            lng = incident.longitude
            route_plan = LogisticsAgent.calculate_optimal_route(
                db=db,
                end=(lat, lng),
                blocked_areas=[],
                unit_type="AMBULANCE"
            )
            start_point = route_plan["start_coords"]
            db.add(models.Route(
                event_id=incident.id,
                start_location=create_point(start_point["lat"], start_point["lng"]),
                end_location=create_point(lat, lng),
                path_geometry=create_linestring_from_tuples([(p["lat"], p["lng"]) for p in route_plan["path_geometry"]]),
                estimated_time_mins=route_plan["estimated_time_mins"]
            ))
            incident.status = models.EventStatus.IN_PROGRESS
            log_entry["decision"] = "DISPATCH"
            log_entry["unit_assigned"] = route_plan.get("unit_id")

        db.commit()
        
        # Broadcast Update
        from routers.websockets import manager
        import json
        await manager.broadcast(json.dumps({
            "type": "vision_complete",
            "data": {
                "id": str(incident.id),
                "confidence": incident.confidence_score,
                "priority": incident.priority_score,
                "status": incident.status.value
            }
        }))

    except Exception as e:
        logger.error(f"Vision job failed: {e}")
        db.rollback()
        if incident:
            incident.vision_status = "FAILED"
            db.commit()
    finally:
        db.close()
