"""Database initialization and index verification.

Verifies connectivity, inspects existing indexes, and creates required
indexes only if they are missing. Never drops, replaces, or modifies
existing indexes or documents.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.connection import get_db


REQUIRED_LISTING_INDEXES = [
    {"keys": [("listingId", 1)], "unique": True, "name": "listingId_unique"},
    {"keys": [("transactionType", 1)], "unique": False, "name": "transactionType_idx"},
    {"keys": [("brand", 1)], "unique": False, "name": "brand_idx"},
    {"keys": [("category", 1)], "unique": False, "name": "category_idx"},
    {"keys": [("location", 1)], "unique": False, "name": "location_idx"},
]


async def init_db() -> None:
    """Initialize database: verify connectivity and ensure required indexes.

    For each required index:
    - If an existing index has the same ordered key pattern, verify its
      properties (e.g., unique flag) match the requirement.
    - If properties match, the index satisfies the requirement; skip creation.
    - If properties do not match (e.g., unique=False but required unique=True),
      raise a clear error. Do not modify the existing index.
    - If no index with matching key pattern exists, check whether the required
      index name conflicts with an existing index on different keys. If so,
      raise a clear error. Otherwise, create the missing index.

    This function is idempotent: running it repeatedly does not create
    duplicate indexes.
    """
    db = get_db()

    # Verify connectivity via ping
    await db.command("ping")

    # Inspect existing indexes on listings collection
    existing_indexes = await db["listings"].list_indexes().to_list(length=None)

    # Build lookup by ordered key pattern and by name
    existing_by_key_pattern = {}
    existing_by_name = {}
    for idx in existing_indexes:
        key = idx.get("key") or {}
        key_pattern = tuple(key.items())  # Preserve key order
        name = idx.get("name")
        existing_by_key_pattern[key_pattern] = idx
        existing_by_name[name] = idx

    for index_def in REQUIRED_LISTING_INDEXES:
        index_name = index_def["name"]
        keys = index_def["keys"]
        key_pattern = tuple(keys)  # Preserve key order
        unique = index_def.get("unique", False)

        # Check if an index with the same ordered key pattern already exists
        existing_idx = existing_by_key_pattern.get(key_pattern)
        if existing_idx is not None:
            # Verify required properties against the existing index
            existing_unique = existing_idx.get("unique", False)
            if unique and not existing_unique:
                raise ValueError(
                    f"Index '{existing_idx.get('name')}' on {keys} exists but "
                    f"is not unique. Required unique=True."
                )
            # Properties match - index satisfies the requirement
            continue

        # No index with matching key pattern found.
        # Check if the required name conflicts with an existing index on
        # different keys.
        if index_name in existing_by_name:
            conflicting_idx = existing_by_name[index_name]
            conflicting_keys = tuple((conflicting_idx.get("key") or {}).items())
            raise ValueError(
                f"Index name '{index_name}' conflicts with existing index on "
                f"{conflicting_keys}. Required index on {keys} with name "
                f"'{index_name}' cannot be created."
            )

        # Create the missing index
        await db["listings"].create_index(keys, name=index_name, unique=unique)
