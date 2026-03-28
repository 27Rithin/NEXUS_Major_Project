import auth
from database import SessionLocal
import models

db = SessionLocal()
try:
    user = db.query(models.User).filter(models.User.email == "rishirithin@gmail.com").first()
    if user:
        new_password = "Helenricky@04"
        new_hash = auth.get_password_hash(new_password)
        user.password_hash = new_hash
        db.commit()
        print(f"Password for {user.email} has been updated.")
        print(f"New Hash: {new_hash}")
    else:
        print("User not found")
finally:
    db.close()
