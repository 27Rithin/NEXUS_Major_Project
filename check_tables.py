import psycopg2
import sys

def check_tables():
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
        cur = conn.cursor()
        
        print(f"Checking tables in '{target_db}'...")
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        tables = cur.fetchall()
        print(f"✅ Tables found: {[t[0] for t in tables]}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_tables()
