# NEXUS Database ER Diagram

Below is the text representation of the ER diagram illustrating the database schema and relations for the NEXUS Multi-Modal Disaster Response Agent.

```mermaid
erDiagram
    DISASTER_EVENTS ||--o{ VISION_ANALYSIS : "has_analysis"
    DISASTER_EVENTS ||--o{ WEATHER_DATA : "has_weather_context"
    DISASTER_EVENTS ||--o{ ROUTES : "triggers_route"

    DISASTER_EVENTS {
        uuid id PK
        varchar title
        text description
        varchar category
        geometry location "PostGIS Point"
        float social_nlp_score "0.0 to 1.0"
        float priority_score
        boolean is_verified
        timestamp created_at
        timestamp updated_at
    }

    VISION_ANALYSIS {
        uuid id PK
        uuid event_id FK
        varchar image_url
        jsonb detected_objects
        float severity_score "1 to 10"
        timestamp analyzed_at
    }

    WEATHER_DATA {
        uuid id PK
        uuid event_id FK
        float temperature
        float wind_speed
        float precipitation
        float weather_severity
        timestamp recorded_at
    }

    ROUTES {
        uuid id PK
        uuid event_id FK
        geometry start_location "PostGIS Point"
        geometry end_location "PostGIS Point"
        geometry path_geometry "PostGIS LineString"
        float estimated_time_mins
        timestamp created_at
    }

    BLOCKED_ROADS {
        uuid id PK
        varchar road_name
        varchar severity
        geometry blockage_location "PostGIS LineString/Point"
        timestamp reported_at
    }
```

### Key Considerations
1. **Performance**: GIST Indexes are created for all `GEOMETRY` columns (`location`, `blockage_location`, `start_location`, `end_location`) to optimize spatial queries used mostly during route calculation and visualization.
2. **PostGIS**: Requires PostGIS to be enabled (`CREATE EXTENSION postgis;`).
3. **Foreign Keys**: `ON DELETE CASCADE` ensures that if an event is deleted, all related vision data, weather context, and associated generated rescue routes are cleared up securely.
