-- Enable PostGIS extension for spatial data
CREATE EXTENSION IF NOT EXISTS postgis;
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: disaster_events
CREATE TABLE disaster_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- e.g., 'Flood', 'Fire', 'Accident'
    location GEOMETRY(Point, 4326) NOT NULL,
    social_nlp_score FLOAT DEFAULT 0.0, -- NLP confidence score from social media (0.0 to 1.0)
    priority_score FLOAT DEFAULT 0.0, -- Calculated by cross-modal engine
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: vision_analysis
CREATE TABLE vision_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
    image_url VARCHAR(255),
    detected_objects JSONB, -- e.g., ["fire", "human"]
    severity_score FLOAT NOT NULL, -- 1.0 to 10.0 scale, converted internally to LOW/MEDIUM/HIGH threshold
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: weather_data
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
    temperature FLOAT,
    wind_speed FLOAT,
    precipitation FLOAT,
    weather_severity FLOAT NOT NULL, -- Calculated based on inputs (0.0 to 1.0)
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: blocked_roads
CREATE TABLE blocked_roads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    road_name VARCHAR(255) NOT NULL,
    severity VARCHAR(50) DEFAULT 'HIGH', -- LOW, MEDIUM, HIGH
    blockage_location GEOMETRY(LineString, 4326) NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: routes
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
    start_location GEOMETRY(Point, 4326) NOT NULL,
    end_location GEOMETRY(Point, 4326) NOT NULL,
    path_geometry GEOMETRY(LineString, 4326) NOT NULL,
    estimated_time_mins FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial indexes for performance optimization
CREATE INDEX idx_disaster_events_location ON disaster_events USING GIST (location);
CREATE INDEX idx_blocked_roads_location ON blocked_roads USING GIST (blockage_location);
CREATE INDEX idx_routes_start_location ON routes USING GIST (start_location);
CREATE INDEX idx_routes_end_location ON routes USING GIST (end_location);

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_disaster_events_modtime
BEFORE UPDATE ON disaster_events
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
