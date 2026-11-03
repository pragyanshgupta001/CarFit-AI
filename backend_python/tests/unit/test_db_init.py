"""Unit tests for database initialization (app/db/init.py)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.init import init_db


class _MockCursor:
    """Mock Motor cursor: list_indexes() returns this, .to_list() is async."""

    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, length=None):
        return self._docs


def _make_index(name, key_dict, unique=False):
    """Helper to build a mock index document."""
    return {
        "v": 2,
        "key": key_dict,
        "name": name,
        "unique": unique,
    }


@pytest.fixture(autouse=True)
def reset_globals():
    """Reset module-level globals before each test."""
    import app.db.connection as conn_mod

    conn_mod._client = None
    conn_mod._db = None
    yield
    conn_mod._client = None
    conn_mod._db = None


def _make_db_with_indexes(index_docs):
    """Build a mock database whose listings collection returns given indexes."""
    mock_db = MagicMock()
    mock_db.command = AsyncMock(return_value={"ok": 1})
    mock_db.list_indexes = MagicMock(return_value=_MockCursor(index_docs))
    mock_collection = MagicMock()
    mock_collection.list_indexes = mock_db.list_indexes
    mock_collection.create_index = AsyncMock()
    mock_db.__getitem__ = MagicMock(return_value=mock_collection)
    return mock_db, mock_collection


async def test_existing_valid_unique_listingid_index_is_accepted():
    """An existing unique listingId index satisfies the requirement; no creation."""
    mock_db, mock_collection = _make_db_with_indexes(
        [_make_index("listingId_unique", {"listingId": 1}, unique=True)]
    )

    with patch("app.db.init.get_db", return_value=mock_db):
        await init_db()

    # listingId_unique should NOT be created (already satisfies requirement)
    listingid_calls = [
        c
        for c in mock_collection.create_index.call_args_list
        if c.args[0] == [("listingId", 1)]
    ]
    assert len(listingid_calls) == 0, "listingId_unique index should not be created"


async def test_existing_non_unique_listingid_index_causes_error():
    """An existing non-unique listingId index raises a clear error."""
    mock_db, mock_collection = _make_db_with_indexes(
        [_make_index("listingId_1", {"listingId": 1}, unique=False)]
    )

    with patch("app.db.init.get_db", return_value=mock_db):
        with pytest.raises(ValueError, match="is not unique"):
            await init_db()

    mock_collection.create_index.assert_not_called()


async def test_existing_equivalent_non_unique_index_different_name_accepted():
    """An existing non-unique index with same keys but different name satisfies requirement."""
    mock_db, mock_collection = _make_db_with_indexes(
        [_make_index("txn_type_custom", {"transactionType": 1}, unique=False)]
    )

    with patch("app.db.init.get_db", return_value=mock_db):
        await init_db()

    # transactionType index should NOT be created (satisfied by existing equivalent)
    txn_calls = [
        c
        for c in mock_collection.create_index.call_args_list
        if c.args[0] == [("transactionType", 1)]
    ]
    assert len(txn_calls) == 0, "transactionType index should not be created"


async def test_missing_required_index_is_created():
    """When no indexes exist, all required indexes are created."""
    mock_db, mock_collection = _make_db_with_indexes([])

    with patch("app.db.init.get_db", return_value=mock_db):
        await init_db()

    assert mock_collection.create_index.call_count == 5
    call_args_list = mock_collection.create_index.call_args_list
    expected = [
        ([("listingId", 1)], {"name": "listingId_unique", "unique": True}),
        ([("transactionType", 1)], {"name": "transactionType_idx", "unique": False}),
        ([("brand", 1)], {"name": "brand_idx", "unique": False}),
        ([("category", 1)], {"name": "category_idx", "unique": False}),
        ([("location", 1)], {"name": "location_idx", "unique": False}),
    ]
    for i, call in enumerate(call_args_list):
        assert call.args[0] == expected[i][0], f"Call {i} args mismatch: {call.args[0]}"
        assert call.kwargs == expected[i][1], f"Call {i} kwargs mismatch: {call.kwargs}"


async def test_running_initialization_twice_does_not_create_duplicates():
    """Second run finds existing indexes by key pattern and skips creation."""
    mock_db = MagicMock()
    mock_db.command = AsyncMock(return_value={"ok": 1})

    call_count = [0]

    def list_indexes_side_effect():
        call_count[0] += 1
        if call_count[0] == 1:
            return _MockCursor([])
        return _MockCursor(
            [
                _make_index("listingId_unique", {"listingId": 1}, unique=True),
                _make_index("transactionType_idx", {"transactionType": 1}, unique=False),
                _make_index("brand_idx", {"brand": 1}, unique=False),
                _make_index("category_idx", {"category": 1}, unique=False),
                _make_index("location_idx", {"location": 1}, unique=False),
            ]
        )

    mock_db.list_indexes = MagicMock(side_effect=list_indexes_side_effect)
    mock_collection = MagicMock()
    mock_collection.list_indexes = mock_db.list_indexes
    mock_collection.create_index = AsyncMock()
    mock_db.__getitem__ = MagicMock(return_value=mock_collection)

    with patch("app.db.init.get_db", return_value=mock_db):
        await init_db()
        await init_db()

    assert mock_collection.create_index.call_count == 5


async def test_conflicting_index_name_causes_error():
    """An existing index with the required name but different keys raises error."""
    mock_db, mock_collection = _make_db_with_indexes(
        [_make_index("listingId_unique", {"otherField": 1}, unique=False)]
    )

    with patch("app.db.init.get_db", return_value=mock_db):
        with pytest.raises(ValueError, match="conflicts with existing index"):
            await init_db()

    mock_collection.create_index.assert_not_called()


async def test_multiple_missing_indexes_all_created():
    """When only _id_ index exists, all 5 required indexes are created."""
    mock_db, mock_collection = _make_db_with_indexes(
        [_make_index("_id_", {"_id": 1}, unique=False)]
    )

    with patch("app.db.init.get_db", return_value=mock_db):
        await init_db()

    assert mock_collection.create_index.call_count == 5
