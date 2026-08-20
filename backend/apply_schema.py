import os
import sys
import psycopg2
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

def run_migration():
    print("Connecting to Supabase PostgreSQL database via DATABASE_URL...")
    if not DATABASE_URL:
        print("[ERROR] DATABASE_URL not found in backend/.env!")
        return

    schema_file = os.path.join(os.path.dirname(__file__), "..", "supabase_schema.sql")
    if not os.path.exists(schema_file):
        print(f"Error: {schema_file} not found")
        return

    with open(schema_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("Applying schema migration to Supabase PostgreSQL...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql_content)
        print("✓ Schema migration executed successfully via psycopg2!")
        
        # Verify video_chunks table exists
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'video_chunks'")
        cols = cur.fetchall()
        print(f"✓ Verified public.video_chunks columns: {[c[0] for c in cols]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[MIGRATION ERROR] {e}")

if __name__ == "__main__":
    run_migration()
