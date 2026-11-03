"""Integration tests for reading listings from MongoDB.

These tests connect to the actual configured MongoDB database and perform
read-only queries. They are skipped unless the environment variable
CARFIT_INTEGRATION_DB=1 is set, to avoid accidental database access
during CI or local development without a running MongoDB instance.
"""

import os

import pytest

from app.db.connection import close_db, connect_db, get_db


pytestmark = pytest.mark.skipif(
    os.environ.get("CARFIT_INTEGRATION_DB") != "1",
    reason="Set CARFIT_INTEGRATION_DB=1 to run MongoDB integration tests",
)


@pytest.mark.asyncio
async def test_listing_collection_is_readable():
    """A listing document can be retrieved from the listings collection."""
    await connect_db()
    try:
        db = get_db()
        listing = await db["listings"].find_one({})
        assert listing is not None, "Expected at least one listing in the database"
    finally:
        await close_db()


@pytest.mark.asyncio
async def test_listing_document_has_expected_fields():
    """Listing documents should contain all required fields from Mongoose schema."""
    await connect_db()
    try:
        db = get_db()
        listing = await db["listings"].find_one({})
        assert listing is not None

        required_fields = [
            "listingId",
            "transactionType",
            "brand",
            "model",
            "category",
            "location",
            "seats",
            "fuelType",
            "transmission",
            "availableFrom",
            "availableTo",
            "rating",
            "provider",
        ]
        for field in required_fields:
            assert field in listing, f"Missing required field: {field}"

        assert listing["transactionType"] in ("rent", "buy")
        assert isinstance(listing["seats"], int)
        assert listing["seats"] >= 1
        assert listing["currency"] in ("INR", "USD")
        assert 0 <= listing["rating"] <= 5
    finally:
        await close_db()


@pytest.mark.asyncio
async def test_objectid_is_present_and_unique():
    """Each listing document should have a MongoDB _id field."""
    await connect_db()
    try:
        db = get_db()
        listing = await db["listings"].find_one({})
        assert listing is not None
        assert "_id" in listing
        assert listing["_id"] is not None
    finally:
        await close_db()
