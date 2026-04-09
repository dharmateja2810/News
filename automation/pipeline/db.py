"""
Shared PostgreSQL connection for the Python pipeline.
Reads DATABASE_URL from backend/config.env (or a local .env file).
"""

import os
import re
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Try backend/config.env relative to this file, then a local .env
_here = Path(__file__).resolve().parent
_backend_env = _here.parent.parent / "backend" / "config.env"
_local_env = _here / ".env"

if _backend_env.exists():
    load_dotenv(_backend_env)
elif _local_env.exists():
    load_dotenv(_local_env)
else:
    load_dotenv()  # fall back to environment variables


def get_connection():
    """
    Return a new psycopg2 connection.
    Uses DATABASE_URL from environment, converting Prisma-style
    connection strings if needed.
    """
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")

    # psycopg2 uses 'postgresql://' scheme; Prisma sometimes uses 'postgres://'
    db_url = re.sub(r"^postgres://", "postgresql://", db_url)

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    return conn


def dict_cursor(conn):
    """Return a DictCursor for the given connection."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
