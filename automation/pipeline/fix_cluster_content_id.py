"""
One-time migration: fix missing DB-level defaults on cluster_content
and story_clusters.  Prisma's @default(uuid()) and @updatedAt are
ORM-level only — raw SQL INSERTs need actual column defaults set on
the DB.
"""
from db import get_connection, release_connection

conn = get_connection()
try:
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

        # ── cluster_content defaults ──
        cur.execute("ALTER TABLE cluster_content ALTER COLUMN id SET DEFAULT gen_random_uuid();")
        cur.execute("ALTER TABLE cluster_content ALTER COLUMN created_at SET DEFAULT NOW();")
        cur.execute("ALTER TABLE cluster_content ALTER COLUMN updated_at SET DEFAULT NOW();")

        # ── story_clusters defaults ──
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN has_paywalled SET DEFAULT false;")
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN opinion_ratio SET DEFAULT 0.0;")
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN cluster_quality SET DEFAULT 0.0;")
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN oz_score SET DEFAULT 0.0;")
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN oz_score_morning SET DEFAULT 0.0;")
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN oz_score_evening SET DEFAULT 0.0;")
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN article_count SET DEFAULT 0;")
        cur.execute("ALTER TABLE story_clusters ALTER COLUMN unique_source_count SET DEFAULT 0;")

    conn.commit()
    print("Done: DB-level defaults set on cluster_content and story_clusters")
except Exception as e:
    conn.rollback()
    print(f"Error: {e}")
finally:
    release_connection(conn)
