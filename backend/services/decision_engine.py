from typing import Dict, Any, Optional
import math
from datetime import datetime, timedelta
import models

class DecisionEngine:
    """
    Cross-Modal Reasoning Engine.
    Combines NLP, Vision, Weather, and Sensor utilizing weights, confidence scoring, 
    and temporal decay.
    """
    
    # Production Weights for Decision Engine
    WEIGHT_NLP = 0.4
    WEIGHT_VISION = 0.3
    WEIGHT_WEATHER = 0.2
    WEIGHT_SENSOR = 0.1
    
    # Thresholds to trigger auto route generation per category
    DEFAULT_TRIGGER_THRESHOLD = 0.75
    CATEGORY_THRESHOLDS = {
        "Flood": 0.65,
        "Urban Fire": 0.55,
        "Forest Fire": 0.60,
        "Earthquake": 0.55,
        "Building Collapse": 0.60,
        "Industrial Accident": 0.60
    }

    # Reliability weights of the source of the data
    SOURCE_WEIGHTS = {
        "sensor": 1.0,
        "legacy_call": 0.9,
        "social": 0.7,
        "unknown": 0.5
    }
    
    # Temporal decay constant lambda (e.g., decays noticeably over 24 hours)
    DECAY_CONSTANT = 0.05

    @classmethod
    def evaluate_priority(cls, 
                          nlp_score: float = 0.0, 
                          vision_score_normalized: float = 0.0, 
                          weather_score: float = 0.0,
                          sensor_score: float = 0.0,
                          nearby_reports_score: float = 0.0,
                          historical_risk_score: float = 0.0,
                          hours_since_update: float = 0.0,
                          category: str = "Unknown",
                          source: str = "unknown",
                          incident_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculates Adjusted Priority and Confidence.
        Includes PENDING_REVIEW escalation and Decision Audit Logging.
        """
        # Step 1: Raw base priority (0..1) using production-grade weights
        # We also factor in surrounding intelligence (nearby/historical) but the 4 core pillars take precedence
        core_pillar_sum = (
            (cls.WEIGHT_NLP * nlp_score) + 
            (cls.WEIGHT_VISION * vision_score_normalized) +
            (cls.WEIGHT_WEATHER * weather_score) +
            (cls.WEIGHT_SENSOR * sensor_score)
        )
        
        # Contextual intelligence (weighted at 10% of total)
        context_sum = (
            (0.05 * nearby_reports_score) + 
            (0.05 * historical_risk_score)
        )
        
        base_priority_0_1 = core_pillar_sum + context_sum
        
        # Step 2: Explicit confidence (0..1) based on the 4 core modalities.
        conf_nlp = 0.25 if nlp_score > 0 else 0.0
        conf_vision = 0.25 if vision_score_normalized > 0 else 0.0
        conf_weather = 0.25 if weather_score > 0 else 0.0
        conf_sensor = 0.25 if sensor_score > 0 else 0.0
        confidence_score = conf_nlp + conf_vision + conf_weather + conf_sensor

        # Step 3: Decaying and Source factors
        decay_factor = math.exp(-cls.DECAY_CONSTANT * hours_since_update)
        source_weight = cls.SOURCE_WEIGHTS.get((source or "unknown").lower(), cls.SOURCE_WEIGHTS["unknown"])
        source_factor = 0.5 + (0.5 * source_weight)
        final_priority_0_1 = max(0.0, min(1.0, base_priority_0_1 * decay_factor * source_factor))
        
        priority_score_10 = round(final_priority_0_1 * 10.0, 3)

        # Step 4: Categorization and Escalation Rules
        severity = "LOW"
        status_message = "No immediate danger detected. Stay safe."
        color = "GREEN"
        status = models.EventStatus.PENDING
        review_deadline = None
        trigger_logistics = False

        # Threshold based on category
        threshold = cls.CATEGORY_THRESHOLDS.get(category, cls.DEFAULT_TRIGGER_THRESHOLD)

        if priority_score_10 >= 7.0 and confidence_score < 0.6:
            status = models.EventStatus.PENDING_REVIEW
            severity = "UNVERIFIED"
            status_message = "Signal received. Awaiting multi-modal verification."
            color = "YELLOW"
            review_deadline = datetime.utcnow() + timedelta(minutes=2)
        elif final_priority_0_1 >= 0.75 and confidence_score >= 0.7:
            severity = "CRITICAL"
            status_message = "Rescue team is on the way. Stay where you are."
            color = "RED"
            trigger_logistics = True
        elif final_priority_0_1 >= 0.5 and confidence_score >= 0.5:
            severity = "MEDIUM"
            status_message = "Situation under monitoring. Stay alert."
            color = "ORANGE"

        # Step 5: Explainable AI (XAI) Contribution Calculation
        # We calculate how much each pillar contributed to the CORE part of the score
        total_contribution = core_pillar_sum if core_pillar_sum > 0 else 1.0
        xai_breakdown = {
            "nlp_contribution": round((cls.WEIGHT_NLP * nlp_score / total_contribution) * 100, 1) if core_pillar_sum > 0 else 25.0,
            "vision_contribution": round((cls.WEIGHT_VISION * vision_score_normalized / total_contribution) * 100, 1) if core_pillar_sum > 0 else 25.0,
            "weather_contribution": round((cls.WEIGHT_WEATHER * weather_score / total_contribution) * 100, 1) if core_pillar_sum > 0 else 25.0,
            "sensor_contribution": round((cls.WEIGHT_SENSOR * sensor_score / total_contribution) * 100, 1) if core_pillar_sum > 0 else 25.0,
        }

        decision_data = {
            "priority_score": priority_score_10,
            "confidence_score": round(confidence_score, 2),
            "severity_level": severity,
            "status_message": status_message,
            "color": color,
            "status": status,
            "review_deadline": review_deadline,
            "trigger_logistics": trigger_logistics and confidence_score >= threshold,
            "xai_breakdown": xai_breakdown,
            "breakdown": {
                "base_priority": round(base_priority_0_1, 2),
                "decay_factor": round(decay_factor, 2),
                "source_factor": round(source_factor, 2),
                "threshold": threshold,
            }
        }

        # Fix 5: Decision Audit Log
        # This is the structured log entry that should be appended to the Incident.
        # Note: The actual DB append should happen in the service layer using JSONB operators.
        decision_data["log_entry"] = {
            "timestamp": datetime.utcnow().isoformat(),
            "trigger": "initial_evaluation", # Default, can be overridden by caller
            "nlp_score": nlp_score,
            "vision_score": vision_score_normalized,
            "weather_score": weather_score,
            "weighted_priority": priority_score_10,
            "confidence": round(confidence_score, 2),
            "decision": "DISPATCH" if trigger_logistics else ("PENDING_REVIEW" if review_deadline else "MONITORED"),
            "unit_assigned": None, # Filled by Logistics if triggered
            "operator_override": False
        }

        return decision_data
