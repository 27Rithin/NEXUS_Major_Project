from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, Any

from database import get_db
import models
from services.social_agent import SocialMediaAgent
from services.vision_agent import VisionAnalysisAgent
from utils.spatial import create_point

router = APIRouter()

@router.post("/social/simulate")
def simulate_social_media_ingestion(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Simulates receiving a new social media post, analyzing it, and storing an event if it exceeds threshold"""
    raw_text = SocialMediaAgent.generate_mock_post()
    analysis = SocialMediaAgent.analyze_text(raw_text)
    
    if analysis["is_actionable"]:
        # Mocking location for demo (e.g. New Delhi coordinates with slight random offset)
        import random
        lat = 13.6288 + random.uniform(-0.15, 0.15)
        lng = 79.4192 + random.uniform(-0.15, 0.15)
        
        new_event = models.DisasterEvent(
            title=f"Possible {analysis['category']} reported locally",
            description=raw_text,
            category=analysis['category'],
            location=create_point(lat, lng),
            social_nlp_score=analysis['nlp_score']
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        
        return {
            "message": "Actionable event created from social media",
            "post": raw_text,
            "analysis": analysis,
            "event_id": new_event.id
        }
    return {"message": "Post analyzed but not actionable", "post": raw_text, "analysis": analysis}

@router.post("/vision/analyze/{event_id}")
def analyze_vision_for_event(event_id: UUID, image_url: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Mocks image upload and analysis for a given event."""
    event = db.query(models.DisasterEvent).filter(models.DisasterEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    vision_result = VisionAnalysisAgent.analyze_image(image_url)
    
    vision_record = models.VisionAnalysis(
        event_id=event.id,
        image_url=image_url,
        detected_objects=vision_result["detected_objects"],
        severity_score=vision_result["severity_score"]
    )
    db.add(vision_record)
    db.commit()
    
    return {
        "message": "Vision analysis complete",
        "vision_result": vision_result
    }
