import bcrypt
import hashlib

def _pre_hash(password: str) -> bytes:
    return hashlib.sha256(password.encode('utf-8')).hexdigest().encode('utf-8')

password = "Helenricky@04"
pre = _pre_hash(password)
salt = bcrypt.gensalt()
hashed = bcrypt.hashpw(pre, salt)

print(f"Password: {password}")
print(f"Pre-hash: {pre}")
print(f"Hash: {hashed}")

is_valid = bcrypt.checkpw(pre, hashed)
print(f"Check 1 (pre): {is_valid}")

is_valid_direct = bcrypt.checkpw(password.encode('utf-8'), hashed)
print(f"Check 2 (direct): {is_valid_direct}")

# Simulate DB storage (str)
hashed_str = hashed.decode('utf-8')
is_valid_str = bcrypt.checkpw(pre, hashed_str.encode('utf-8'))
print(f"Check 3 (DB-sim): {is_valid_str}")
