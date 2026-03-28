-- Insert a dummy event for a Flood in a generic region (City Center)
INSERT INTO disaster_events (id, title, description, category, location, social_nlp_score, priority_score, is_verified) 
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
    'Severe Flooding downtown', 
    'Multiple reports of water levels rising up to 3 feet in the main square.', 
    'Flood', 
    ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326), -- E.g. New Delhi
    0.85, 
    0.0, -- Will be recalculated by decision engine
    TRUE
);

-- Insert dummy vision analysis for the event
INSERT INTO vision_analysis (event_id, image_url, detected_objects, severity_score)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'https://example.com/flood.jpg',
    '["flood_water", "stranded_vehicle"]',
    8.5
);

-- Insert dummy weather data
INSERT INTO weather_data (event_id, temperature, wind_speed, precipitation, weather_severity)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    24.5,
    15.0,
    120.5,
    0.9
);

-- Insert couple of blocked roads for logistics simulation
INSERT INTO blocked_roads (road_name, severity, blockage_location)
VALUES (
    'Main Street Bridge', 
    'HIGH', 
    ST_SetSRID(ST_MakeLine(ST_MakePoint(77.2100, 28.6140), ST_MakePoint(77.2110, 28.6150)), 4326)
),
(
    'Highway 42 Underpass', 
    'MEDIUM', 
    ST_SetSRID(ST_MakeLine(ST_MakePoint(77.2050, 28.6100), ST_MakePoint(77.2060, 28.6090)), 4326)
);
