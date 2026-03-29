from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

class PointSchema(BaseModel):
    lat: float
    lng: float

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    location: PointSchema
    social_nlp_score: float = 0.0

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: UUID
    priority_score: float
    confidence_score: float = 0.0
    severity_level: str
    status_message: Optional[str] = None
    status: str
    is_verified: bool
    override_lat: Optional[float] = None
    override_lng: Optional[float] = None
    override_timestamp: Optional[datetime] = None
    is_location_overridden: bool = False
    xai_breakdown: Dict[str, float] = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    name: str
    email: str
    organization: Optional[str] = None
    role: str = "Viewer"

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class DispatchLogCreate(BaseModel):
    unit_type: str
    notes: Optional[str] = None
    override_lat: Optional[float] = None
    override_lng: Optional[float] = None

class DispatchLogResponse(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    unit_type: str
    dispatched_at: datetime
    notes: Optional[str]
    
    class Config:
        from_attributes = True

class VisionAnalysisCreate(BaseModel):
    event_id: UUID
    image_url: Optional[str] = None
    detected_objects: List[str] = []
    severity_score: float = Field(..., ge=1, le=10)

class WeatherDataCreate(BaseModel):
    event_id: UUID
    temperature: float
    wind_speed: float
    precipitation: float
    weather_severity: float = Field(..., ge=0.0, le=1.0)
    
class RouteResponse(BaseModel):
    id: UUID
    event_id: UUID
    start_location: PointSchema
    end_location: PointSchema
    path_geometry: List[PointSchema] # Simplified for API JSON
    estimated_time_mins: float

    class Config:
        from_attributes = True

class SuggestDispatchCreate(BaseModel):
    unit_type: str
    dest_lat: float
    dest_lng: float

class SuggestDispatchResponse(BaseModel):
    route_waypoints: List[PointSchema]
    unit_current_position: PointSchema
    estimated_arrival_seconds: int
    unit_type: str
