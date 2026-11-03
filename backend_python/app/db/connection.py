"""MongoDB connection management using Motor (async driver).

Provides:
- AsyncIOMotorClient configured from MONGO_URI
- Database selection for car_market
- connect_db() / close_db() lifecycle functions
- get_db() FastAPI dependency

No credentials are logged or printed.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Create the Motor client and select the car_market database.

    Raises on connection failure so FastAPI startup can abort cleanly.
    """
    global _client, _db

    if not settings.mongo_uri:
        raise RuntimeError("MONGO_URI is not configured")

    _client = AsyncIOMotorClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=20000,
    )
    _db = _client.get_database("car_market")

    # Verify connectivity immediately
    await _db.command("ping")


async def close_db() -> None:
    """Close the Motor client connection pool."""
    global _client, _db

    if _client is not None:
        _client.close()
        _client = None
        _db = None


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency returning the current database instance.

    Must be called after connect_db() has completed (e.g., in a route
    protected by FastAPI's lifespan startup).
    """
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
