import auth
from database import SessionLocal
import models

db = SessionLocal()
try:
    user = db.query(models.User).filter(models.User.email == "rishirithin@gmail.com").first()
    if user:
        password = "Helenricky@04"
        is_valid = auth.verify_password(password, user.password_hash)
        print(f"Password 'Helenricky@04' valid? {is_valid}")
        
        # Test without pre-hash just in case
        import bcrypt
        is_valid_direct = bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8'))
        print(f"Password 'Helenricky@04' direct valid? {is_valid_direct}")
    else:
        print("User not found")
finally:
    db.close()
