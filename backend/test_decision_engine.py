from services.decision_engine import DecisionEngine

def test_decision_engine():
    print("--- NEXUS DECISION ENGINE TEST SUITE ---")
    
    # Test 1: High Agreement (All modalities detect disaster)
    # Should yield High Confidence, High Priority
    t1 = DecisionEngine.evaluate_priority(nlp_score=0.9, vision_score_normalized=0.8, weather_score=0.9, sensor_score=0.8, category="Flood", source="social")
    print(f"Test 1 (High Agreement): Priority={t1['priority_score']}, Confidence={t1['confidence_score']}")
    assert t1['confidence_score'] == 1.0, "Confidence should be 1.0 (4/4)"
    assert t1['priority_score'] > 5.5, "Priority should be high enough on a 0..10 scale"
    
    # Test 2: Low Agreement (Only NLP triggers, others 0)
    # Should yield Low Confidence, drastically reduced Priority
    t2 = DecisionEngine.evaluate_priority(nlp_score=0.9, vision_score_normalized=0.0, weather_score=0.0, sensor_score=0.0, category="Unknown", source="social")
    print(f"Test 2 (Low Agreement): Priority={t2['priority_score']}, Confidence={t2['confidence_score']}")
    assert t2['confidence_score'] == 0.25, "Confidence should be 0.25 (1/4)"
    
    # Test 3: Sensor Only (e.g. Broken water pipe unobserved by humans)
    t3 = DecisionEngine.evaluate_priority(nlp_score=0.0, vision_score_normalized=0.0, weather_score=0.0, sensor_score=0.9, category="Flood", source="sensor")
    print(f"Test 3 (Sensor Only): Priority={t3['priority_score']}, Confidence={t3['confidence_score']}")
    assert t3['confidence_score'] == 0.25, "Confidence should be 0.25 (1/4)"
    
    # Test 4: Temporal Decay
    # Same event tested over 0 hours, 12 hours, and 24 hours
    decay_0 = DecisionEngine.evaluate_priority(nlp_score=0.8, vision_score_normalized=0.8, hours_since_update=0.0, category="Earthquake", source="sensor")
    decay_12 = DecisionEngine.evaluate_priority(nlp_score=0.8, vision_score_normalized=0.8, hours_since_update=12.0, category="Earthquake", source="sensor")
    decay_24 = DecisionEngine.evaluate_priority(nlp_score=0.8, vision_score_normalized=0.8, hours_since_update=24.0, category="Earthquake", source="sensor")
    
    print(f"Test 4 (Temporal Decay): 0h={decay_0['priority_score']}, 12h={decay_12['priority_score']}, 24h={decay_24['priority_score']}")
    assert decay_0['priority_score'] > decay_12['priority_score'] > decay_24['priority_score'], "Priority should decay over time"
    
    print("--- ALL TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    test_decision_engine()
