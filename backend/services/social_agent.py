import random
from typing import Dict, Any

class SocialMediaAgent:
    """
    Simulates monitoring social media streams and classifies text to detect disasters.
    Uses a lightweight keyword-based NLP mock for demonstration purposes.
    """
    
    DISASTER_KEYWORDS = {
        "Flood": ["water", "drowning", "flood", "submerged", "river", "overflow"],
        "Urban Fire": ["smoke", "burning", "fire", "blaze", "apartment", "city fire"],
        "Forest Fire": ["wildfire", "forest", "trees burning", "brush fire"],
        "Earthquake": ["shaking", "tremor", "earthquake", "collapsed", "rubble"],
        "Cyclone": ["hurricane", "cyclone", "wind", "storm surge", "typhoon"],
        "Landslide": ["mudslide", "landslide", "rocks falling", "hill collapse"],
        "Building Collapse": ["roof caved", "building collapsed", "trapped in rubble", "structure failure"],
        "Industrial Accident": ["chemical spill", "factory explosion", "toxic leak", "plant accident"],
        "Road Accident": ["pileup", "highway crash", "multi-vehicle", "transport accident", "truck overturned"]
    }
    
    URGENCY_KEYWORDS = ["help", "trapped", "emergency", "dying", "urgent", "need", "rescue", "casualties"]

    @classmethod
    def analyze_text(cls, text: str) -> Dict[str, Any]:
        """
        Analyzes a given text and returns classification and NLP confidence score.
        Score is 0.0 to 1.0 based on keyword density and urgency.
        """
        text_lower = text.lower()
        score = 0.0
        predicted_category = "Unknown"
        max_matches = 0
        
        # Determine Category
        for category, keywords in cls.DISASTER_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in text_lower)
            if matches > max_matches:
                max_matches = matches
                predicted_category = category
                
        # Calculate Base Score from category matches (max 0.6 contribution)
        if max_matches > 0:
            score += min(0.6, max_matches * 0.2)
            
        # Add urgency weight (max 0.4 contribution)
        urgency_matches = sum(1 for kw in cls.URGENCY_KEYWORDS if kw in text_lower)
        if urgency_matches > 0:
            score += min(0.4, urgency_matches * 0.15)
            
        # Cap score at 1.0
        nlp_confidence_score = min(1.0, score)
        
        # Fake News Detector (Production Requirement)
        reliability_multiplier = 1.0
        fake_keywords = ["forwarded", "spam", "fake", "hoax", "test post", "ignore", "prank"]
        if any(fw in text_lower for fw in fake_keywords):
            reliability_multiplier = 0.2
            logger.info(f"Potential fake news detected in text: {text[:50]}...")

        return {
            "category": predicted_category,
            "nlp_score": round(nlp_confidence_score * reliability_multiplier, 2),
            "is_actionable": nlp_confidence_score >= 0.4 and reliability_multiplier > 0.5,
            "reliability_label": "LOW" if reliability_multiplier < 0.5 else "HIGH"
        }
        
    @classmethod
    def verify_crowd_consensus(cls, db, lat: float, lng: float, radius_km: float = 2.0) -> float:
        """
        Crowd Verification (Requirement): 
        If multiple posts sharing similar coordinates exist, boost confidence.
        """
        import datetime
        from sqlalchemy import func
        one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
        # Simplified coordinate bounding box for "Nearby"
        nearby_count = db.query(models.DisasterEvent).filter(
            models.DisasterEvent.created_at >= one_hour_ago,
            models.DisasterEvent.status != models.EventStatus.RESOLVED,
            # Rough bounding box ~2km
            func.abs(models.DisasterEvent.location.ST_Y() - lat) < 0.02 if hasattr(models.DisasterEvent.location, 'ST_Y') else True,
        ).count()

        if nearby_count >= 3:
            return 0.95 # High Crowd Consensus
        elif nearby_count >= 1:
            return 0.75 # Supported by others
        return 0.5 # Single report / Unverified source
        
    @classmethod
    def generate_mock_post(cls) -> str:
        """Simulates an incoming stream of posts for local testing across all 9 disaster types."""
        posts = [
            "Help! The water is rising fast in downtown, we are trapped on the second floor of the flood.",
            "Huge smoke clouds coming from the nearby forest, looks like a wildfire spreading rapidly.",
            "Just felt a massive earthquake, building was shaking violently and there's rubble.",
            "A massive cyclone is tearing roofs off houses! The wind is unbelievable. Emergency!",
            "Major highway crash with multiple vehicles involved. Urgent rescue needed!",
            "Chemical spill at the industrial plant! Toxic leak reported, people need help evacuating.",
            "The old apartment building just collapsed! People are trapped in the rubble. Need rescue!",
            "Terrible mudslide blocking the mountain road, hill collapse swept cars away.",
            "City fire in the dense apartment block! Huge blaze, need urgent help to evacuate residents."
        ]
        return random.choice(posts)
