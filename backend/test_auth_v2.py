import auth
from database import SessionLocal
import models
import bcrypt

db = SessionLocal()
try:
    user = db.query(models.User).filter(models.User.email == "rishirithin@gmail.com").first()
    if user:
        password = "Helenricky@04"
        print(f"Checking user: {user.email}")
        print(f"DB Hash: {user.password_hash}")
        
        is_valid = auth.verify_password(password, user.password_hash)
        print(f"auth.verify_password returned: {is_valid}")
        
        pre = auth._pre_hash(password)
        is_direct = bcrypt.checkpw(pre, user.password_hash.encode('utf-8'))
        print(f"Direct bcrypt.checkpw(pre, hash) returned: {is_direct}")
    else:
        print("User not found")
finally:
    db.close()
