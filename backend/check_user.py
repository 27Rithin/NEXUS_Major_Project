from database import SessionLocal
import models

db = SessionLocal()
try:
    user = db.query(models.User).filter(models.User.email == "rishirithin@gmail.com").first()
    if user:
        print(f"User found: {user.email}")
        print(f"Name: {user.name}")
        print(f"Role: {user.role}")
        print(f"Hash: {user.password_hash}")
    else:
        print("User NOT found")
finally:
    db.close()
