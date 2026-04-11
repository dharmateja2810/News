"""
Shared PostgreSQL connection for the Python pipeline.
Reads DATABASE_URL from backend/config.env (or a local .env file).
Includes retry logic and connection pooling for resilience.
"""

import os
import re
import time
import logging
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras
import psycopg2.pool
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

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

# Global connection pool (lazy-initialized)
_pool: Optional[psycopg2.pool.SimpleConnectionPool] = None


def _get_db_url() -> str:
    """Get and validate DATABASE_URL from environment."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")
    # psycopg2 uses 'postgresql://' scheme; Prisma sometimes uses 'postgres://'
    return re.sub(r"^postgres://", "postgresql://", db_url)


def _init_pool() -> psycopg2.pool.SimpleConnectionPool:
    """Initialize connection pool (thread-safe singleton)."""
    global _pool
    if _pool is None:
        db_url = _get_db_url()
        # Min 1, max 5 connections in pool
        _pool = psycopg2.pool.SimpleConnectionPool(
            1, 5, db_url,
            connect_timeout=10,
            options="-c statement_timeout=300000"  # 5 min query timeout
        )
        logger.info("Initialized connection pool")
    return _pool


def get_connection(max_retries: int = 3, retry_delay: float = 1.0):
    """
    Return a new psycopg2 connection with automatic retry on transient failures.
    
    Args:
        max_retries: Number of retry attempts for transient failures
        retry_delay: Seconds to wait between retries (exponential backoff)
    
    Returns:
        psycopg2 connection object
    
    Raises:
        psycopg2.Error: After all retries exhausted
    """
    pool = _init_pool()
    last_error = None
    
    for attempt in range(max_retries):
        try:
            conn = pool.getconn()
            conn.autocommit = True  # Reset to default state
            # Test the connection
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            conn.autocommit = False
            logger.debug(f"Got connection from pool (attempt {attempt + 1})")
            return conn
        except (psycopg2.OperationalError, psycopg2.DatabaseError) as e:
            last_error = e
            if attempt < max_retries - 1:
                wait = retry_delay * (2 ** attempt)  # Exponential backoff
                logger.warning(
                    f"Connection attempt {attempt + 1}/{max_retries} failed: {str(e)[:100]}. "
                    f"Retrying in {wait:.1f}s..."
                )
                time.sleep(wait)
            else:
                logger.error(f"All {max_retries} connection attempts failed")
    
    raise last_error


def dict_cursor(conn):
    """Return a DictCursor for the given connection."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def close_pool():
    """Close all connections in the pool (call at shutdown)."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
        logger.info("Closed connection pool")
