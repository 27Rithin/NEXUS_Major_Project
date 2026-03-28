import models
from database import engine, Base

print("Dropping all existing database tables to migrate to V2 Schema...")
Base.metadata.drop_all(bind=engine)

print("Creating all tables in PostgreSQL with new properties...")
Base.metadata.create_all(bind=engine)

print("Database Reset Complete! NEXUS V2 Schema is ready.")
