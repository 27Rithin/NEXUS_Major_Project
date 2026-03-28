import uuid
import enum
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from database import Base

class EventStatus(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    PENDING_REVIEW = "Pending Review"

class DisasterEvent(Base):
    __tablename__ = "disaster_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(50), index=True)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    social_nlp_score = Column(Float, default=0.0)
    priority_score = Column(Float, default=0.0)
    confidence_score = Column(Float, default=0.0)
    severity_level = Column(String(50), default="LOW")
    status_message = Column(Text)
    status = Column(Enum(EventStatus), default=EventStatus.PENDING, index=True)
    is_verified = Column(Boolean, default=False, index=True)
    override_lat = Column(Float, nullable=True)
    override_lng = Column(Float, nullable=True)
    override_timestamp = Column(DateTime(timezone=True), nullable=True)
    is_location_overridden = Column(Boolean, default=False)
    review_deadline = Column(DateTime(timezone=True), nullable=True)
    decision_log = Column(JSONB, default=[], server_default='[]')
    vision_status = Column(String(50), default="PENDING") # PENDING, PROCESSING, COMPLETE, SKIPPED, FAILED
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('ix_disaster_events_decision_log', decision_log, postgresql_using='gin'),
    )

    vision_analysis = relationship("VisionAnalysis", back_populates="event", cascade="all, delete-orphan")
    weather_data = relationship("WeatherData", back_populates="event", cascade="all, delete-orphan")
    routes = relationship("Route", back_populates="event", cascade="all, delete-orphan")

    @property
    def latitude(self):
        if self.location is not None:
            return to_shape(self.location).y
        return None

    @property
    def longitude(self):
        if self.location is not None:
            return to_shape(self.location).x
        return None


class VisionAnalysis(Base):
    __tablename__ = "vision_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_events.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url = Column(String(255))
    detected_objects = Column(JSON)
    severity_score = Column(Float, nullable=False)
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("DisasterEvent", back_populates="vision_analysis")


class WeatherData(Base):
    __tablename__ = "weather_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_events.id", ondelete="CASCADE"), nullable=False, index=True)
    temperature = Column(Float)
    wind_speed = Column(Float)
    precipitation = Column(Float)
    weather_severity = Column(Float, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("DisasterEvent", back_populates="weather_data")


class BlockedRoad(Base):
    __tablename__ = "blocked_roads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    road_name = Column(String(255), nullable=False)
    severity = Column(String(50), default="HIGH")
    blockage_location = Column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=False)
    reported_at = Column(DateTime(timezone=True), server_default=func.now())


class Route(Base):
    __tablename__ = "routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_events.id", ondelete="CASCADE"), nullable=False, index=True)
    start_location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    end_location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    path_geometry = Column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=False)
    estimated_time_mins = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("DisasterEvent", back_populates="routes")

class UserRole(str, enum.Enum):
    ADMIN = "Admin"
    RESPONDER = "Responder"
    VIEWER = "Viewer"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    emergency_contact = Column(String(255), nullable=True)
    home_location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    medical_conditions = Column(Text, nullable=True)
    password_hash = Column(String(255), nullable=False)
    organization = Column(String(255))
    role = Column(Enum(UserRole), default=UserRole.VIEWER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UnitType(str, enum.Enum):
    DRONE = "Drone"
    BOAT = "Boat"
    AMBULANCE = "Ambulance"
    FIRE_ENGINE = "Fire Engine"

class DispatchLog(Base):
    __tablename__ = "dispatch_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    unit_type = Column(Enum(UnitType), nullable=False)
    dispatched_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)

    event = relationship("DisasterEvent")
    user = relationship("User")

class RescueUnitStatus(str, enum.Enum):
    AVAILABLE = "Available"
    BUSY = "Busy"
    OFFLINE = "Offline"

class RescueUnit(Base):
    __tablename__ = "rescue_units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    callsign = Column(String(100), nullable=False, unique=True)
    unit_type = Column(Enum(UnitType), nullable=False)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    status = Column(Enum(RescueUnitStatus), default=RescueUnitStatus.AVAILABLE, index=True)
    last_active_timestamp = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class FailedJob(Base):
    __tablename__ = "failed_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_name = Column(String(255), nullable=False)
    payload = Column(JSON, nullable=False)
    error_message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
