import sys
import os
import bcrypt
import hashlib
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path so we can import models and config
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from config import settings
    from database import Base
    import models
except ImportError as e:
    print(f"❌ Error importing backend modules: {e}")
    sys.exit(1)

def _pre_hash(password: str) -> bytes:
    return hashlib.sha256(password.encode('utf-8')).hexdigest().encode('utf-8')

def verify_env():
    print("="*60)
    print(" NEXUS SYSTEM DOCTOR - Diagnostic Tool")
    print("="*60)

    # 1. Database Connection Check
    print("\n[1/3] Checking Database Connectivity...")
    try:
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful.")
    except Exception as e:
        print(f"❌ FAILED to connect to Database: {e}")
        print("👉 Tip: Check if PostgreSQL is running on port 5432.")
        return

    # 2. User Table & Admin Check
    print("\n[2/3] Checking Admin User Account...")
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        admin_email = "rishirithin@gmail.com"
        user = db.query(models.User).filter(models.User.email == admin_email).first()
        if user:
            print(f"✅ User '{admin_email}' found in database.")
            print(f"   Name: {user.name}")
            print(f"   Role: {user.role}")
            
            # 3. Password Hash Verification
            print("\n[3/3] Verifying Password Hash format...")
            test_pass = "Helenricky@04"
            
            # Check if it matches the current backend logic (with pre-hash)
            match_new = False
            try:
                match_new = bcrypt.checkpw(_pre_hash(test_pass), user.password_hash.encode('utf-8'))
            except: pass
            
            # Check if it matches fallback logic (plaintext bcrypt)
            match_old = False
            try:
                match_old = bcrypt.checkpw(test_pass.encode('utf-8'), user.password_hash.encode('utf-8'))
            except: pass

            if match_new:
                print("✅ Password verified (Modern Hash Format).")
            elif match_old:
                print("⚠️  Password verified (Legacy Hash Format - Fix Recommended).")
            else:
                print("❌ Password verification FAILED for 'Helenricky@04'.")
                print("👉 Use 'python backend/reset_user_pass.py' to fix the hash.")
        else:
            print(f"❌ User '{admin_email}' NOT found.")
            print("👉 Run the backend to auto-seed the database or use a registration script.")

    except Exception as e:
        print(f"❌ Error during user check: {e}")
    finally:
        db.close()

    print("\n" + "="*60)
    print(" DIAGNOSIS COMPLETE")
    print("="*60)

if __name__ == "__main__":
    verify_env()
