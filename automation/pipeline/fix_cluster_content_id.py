"""
One-time migration: fix missing DB-level defaults on cluster_content.
Prisma's @default(uuid()) and @updatedAt are ORM-level only —
raw SQL INSERTs need actual column defaults set on the DB.
"""
from db import get_connection, release_connection

conn = get_connection()
try:
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        cur.execute("ALTER TABLE cluster_content ALTER COLUMN id SET DEFAULT gen_random_uuid();")
        cur.execute("ALTER TABLE cluster_content ALTER COLUMN updated_at SET DEFAULT NOW();")
    conn.commit()
    print("Done: cluster_content.id → gen_random_uuid(), updated_at → NOW()")
except Exception as e:
    conn.rollback()
    print(f"Error: {e}")
finally:
    release_connection(conn)
