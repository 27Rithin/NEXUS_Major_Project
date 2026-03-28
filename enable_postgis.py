import psycopg2
import sys

def enable_postgis():
    user = "postgres"
    password = "Helenricky@04"
    host = "localhost"
    port = "5432"
    target_db = "nexus"

    try:
        conn = psycopg2.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            dbname=target_db
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        print(f"Checking PostGIS in '{target_db}'...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        print("✅ PostGIS extension is enabled.")
        
        cur.execute("SELECT postgis_version();")
        version = cur.fetchone()
        print(f"✅ PostGIS Version: {version[0]}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error enabling PostGIS: {e}")
        sys.exit(1)

if __name__ == "__main__":
    enable_postgis()
