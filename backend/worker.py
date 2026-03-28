import asyncio
import json
import logging
from arq import retry, create_pool
from arq.connections import RedisSettings
from sqlalchemy.orm import Session
from datetime import datetime

import models
from database import SessionLocal
from config import settings
from services.social_agent import SocialMediaAgent
from services.vision_agent import VisionAnalysisAgent
from services.weather_agent import WeatherVerificationAgent
from services.decision_engine import DecisionEngine
from services.logistics_agent import LogisticsAgent
from routers.websockets import manager
from utils.spatial import create_point, create_linestring_from_tuples
import random

logger = logging.getLogger(__name__)

from services.vision_agent import analyze_image_job

async def ingest_social_signal(ctx, mock_text: str):
    """
    ARQ job to process an incoming social signal.
    """
    job_id = ctx.get('job_id')
    logger.info(f"Processing job {job_id}: {mock_text[:50]}...")

    try:
        # NLP Analysis
        nlp_result = SocialMediaAgent.analyze_text(mock_text)
        
        if not nlp_result["is_actionable"]:
            logger.info(f"Job {job_id}: Signal not actionable.")
            return

        lat = random.uniform(13.45, 13.80)
        lng = random.uniform(79.25, 79.60)
        keyword = "flood" if "flood" in mock_text.lower() or "water" in mock_text.lower() else ("fire" if "fire" in mock_text.lower() or "smoke" in mock_text.lower() else "earthquake")
        img_url = f"https://example.com/{keyword}.jpg"

        # Vision is now async. We pass 0.0 as normalized vision score initially.
        weather_result = WeatherVerificationAgent.get_weather_data(lat, lng)

        # Step 3: Initial Decision Engine Evaluation (Vision skipped for now)
        decision = DecisionEngine.evaluate_priority(
            nlp_score=nlp_result["nlp_score"],
            vision_score_normalized=0.0,
            weather_score=weather_result["weather_severity"],
            category=nlp_result["category"] or "Unknown",
            source="social"
        )

        # Step 4: Database Operations
        db: Session = SessionLocal()
        try:
            new_event = models.DisasterEvent(
                title=f"{nlp_result['category']} Incident Detected",
                description=mock_text,
                category=nlp_result["category"],
                location=create_point(lat, lng),
                social_nlp_score=nlp_result["nlp_score"],
                priority_score=decision["priority_score"],
                confidence_score=decision["confidence_score"],
                severity_level=decision["severity_level"],
                status=decision["status"],
                status_message=decision["status_message"],
                review_deadline=decision["review_deadline"],
                decision_log=[decision["log_entry"]],
                vision_status="PENDING" if img_url else "SKIPPED",
                is_verified=False
            )
            db.add(new_event)
            db.flush()

            # Store Weather (Vision will be stored later by the async job)
            db.add(models.WeatherData(
                event_id=new_event.id,
                temperature=weather_result["temperature"],
                wind_speed=weather_result["wind_speed"],
                precipitation=weather_result["precipitation"],
                weather_severity=weather_result["weather_severity"]
            ))
            
            # Logistics (Only if not PENDING_REVIEW and triggered initially)
            if decision["trigger_logistics"] and decision["status"] != models.EventStatus.PENDING_REVIEW:
                route_plan = LogisticsAgent.calculate_optimal_route(
                    db=db,
                    end=(lat, lng),
                    blocked_areas=[],
                    unit_type="AMBULANCE"
                )
                start_point = route_plan["start_coords"]
                db.add(models.Route(
                    event_id=new_event.id,
                    start_location=create_point(start_point["lat"], start_point["lng"]),
                    end_location=create_point(lat, lng),
                    path_geometry=create_linestring_from_tuples([(p["lat"], p["lng"]) for p in route_plan["path_geometry"]]),
                    estimated_time_mins=route_plan["estimated_time_mins"]
                ))
                decision["log_entry"]["unit_assigned"] = route_plan.get("unit_id")
                new_event.decision_log = [decision["log_entry"]]
            
            db.commit()

            # Step 5: Enqueue Vision Job if needed (Fire and Forget)
            if img_url:
                redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
                await redis.enqueue_job('analyze_image_job', str(new_event.id), img_url)
                logger.info(f"Job {job_id}: Enqueued vision analysis for incident {new_event.id}")

            # Step 6: WebSocket Broadcast
            payload = {
                "id": str(new_event.id),
                "title": new_event.title,
                "category": new_event.category,
                "location": {"lat": lat, "lng": lng},
                "priority_score": new_event.priority_score,
                "confidence_score": new_event.confidence_score,
                "severity_level": new_event.severity_level,
                "status": new_event.status.value,
                "status_message": new_event.status_message,
                "vision_status": new_event.vision_status
            }
            await manager.broadcast(json.dumps({"type": "new_incident", "data": payload}))
            
            if new_event.status == models.EventStatus.PENDING_REVIEW:
                await manager.broadcast(json.dumps({"type": "review_required", "data": payload}), channel="operator_queue")
            
            logger.info(f"Job {job_id}: Successfully processed initial incident {new_event.id}")

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        if ctx['job_try'] < 3:
            raise retry(defer=5 * (5 ** (ctx['job_try'] - 1)))
        else:
            db: Session = SessionLocal()
            try:
                failed_job = models.FailedJob(
                    job_name="ingest_social_signal",
                    payload={"mock_text": mock_text},
                    error_message=str(e)
                )
                db.add(failed_job)
                db.commit()
            finally:
                db.close()
            raise e

async def check_escalations(ctx):
    """
    Cron job to auto-escalate incidents that passed their review deadline.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        expired_incidents = db.query(models.DisasterEvent).filter(
            models.DisasterEvent.status == models.EventStatus.PENDING_REVIEW,
            models.DisasterEvent.review_deadline <= now
        ).all()

        for incident in expired_incidents:
            logger.info(f"Auto-escalating incident {incident.id}...")
            
            # Re-run decision logic with high priority force
            # Here we just manually force to CRITICAL as per requirements
            incident.status = models.EventStatus.PENDING # Reset to allow re-evaluation or just force
            incident.severity_level = "CRITICAL"
            incident.status_message = "🚨 AUTO-ESCALATED: Emergency detected. Rescue units are being dispatched."
            
            # Append to log
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "trigger": "auto_escalation",
                "nlp_score": incident.social_nlp_score,
                "vision_score": 1.0, # Assumed high on escalation
                "weather_score": 1.0,
                "weighted_priority": 10.0,
                "confidence": 1.0,
                "decision": "DISPATCH",
                "unit_assigned": None,
                "operator_override": False
            }
            # Use a list copy to trigger SQLAlchemy change tracking if using JSON type
            new_log = list(incident.decision_log)
            new_log.append(log_entry)
            incident.decision_log = new_log

            # Trigger Logistics
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
            
            log_entry["unit_assigned"] = route_plan.get("unit_id")
            incident.status = models.EventStatus.IN_PROGRESS
            
            db.commit()
            
            # Broadcast update
            await manager.broadcast(json.dumps({
                "type": "incident_updated",
                "data": {"id": str(incident.id), "status": "In Progress", "severity": "CRITICAL"}
            }))

    except Exception as e:
        logger.error(f"Error in check_escalations: {e}")
        db.rollback()
    finally:
        db.close()

from arq import cron

class WorkerSettings:
    """
    ARQ Worker configuration.
    """
    functions = [ingest_social_signal, check_escalations, analyze_image_job]
    cron_jobs = [
        cron(check_escalations, minute=None, second={0, 30}) # Every 30 seconds
    ]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
