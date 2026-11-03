"""Unit tests for database connection module (app/db/connection.py)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.connection import close_db, connect_db, get_db


@pytest.fixture(autouse=True)
def reset_globals():
    """Reset module-level globals before each test."""
    import app.db.connection as conn_mod

    conn_mod._client = None
    conn_mod._db = None
    yield
    conn_mod._client = None
    conn_mod._db = None


async def test_connect_db_creates_client_and_database():
    """connect_db() should create a Motor client and select car_market database."""
    with patch("app.db.connection.AsyncIOMotorClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_db = MagicMock()
        mock_client.get_database.return_value = mock_db
        mock_client_cls.return_value = mock_client
        mock_db.command = AsyncMock(return_value={"ok": 1})

        from app.config import settings
        original_uri = settings.mongo_uri
        settings.mongo_uri = "mongodb+srv://user:pass@cluster.example.net/car_market?retryWrites=true&w=majority"

        try:
            await connect_db()
        finally:
            settings.mongo_uri = original_uri

        mock_client_cls.assert_called_once()
        mock_client.get_database.assert_called_once_with("car_market")
        mock_db.command.assert_called_once_with("ping")
        assert get_db() is mock_db


async def test_connect_db_raises_when_mongo_uri_missing():
    """connect_db() should raise RuntimeError when MONGO_URI is not set."""
    from app.config import settings

    original_uri = settings.mongo_uri
    settings.mongo_uri = ""

    try:
        with pytest.raises(RuntimeError, match="MONGO_URI is not configured"):
            await connect_db()
    finally:
        settings.mongo_uri = original_uri


async def test_close_db_clears_globals():
    """close_db() should close the client and clear module globals."""
    with patch("app.db.connection.AsyncIOMotorClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_db = MagicMock()
        mock_client.get_database.return_value = mock_db
        mock_client_cls.return_value = mock_client
        mock_db.command = AsyncMock(return_value={"ok": 1})

        await connect_db()
        assert get_db() is mock_db

        mock_client.close = MagicMock()
        await close_db()

        mock_client.close.assert_called_once()
        # After close, get_db should raise
        import app.db.connection as conn_mod

        assert conn_mod._client is None
        assert conn_mod._db is None


async def test_get_db_raises_before_connect():
    """get_db() should raise RuntimeError if connect_db() was not called."""
    import app.db.connection as conn_mod

    conn_mod._client = None
    conn_mod._db = None

    with pytest.raises(RuntimeError, match="Database not initialized"):
        get_db()
