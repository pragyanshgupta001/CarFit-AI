"""Base Pydantic model for MongoDB documents.

Maps MongoDB _id to a Pydantic id field using aliases. Handles ObjectId
serialization correctly without converting ObjectId to str internally
unless the model is serialized to JSON.
"""

from datetime import datetime
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class BaseDocument(BaseModel):
    """Base class for all MongoDB document models."""

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None,
        },
        from_attributes=True,
    )

    id: Any = Field(default=None, alias="_id")
    createdAt: datetime | None = None
    updatedAt: datetime | None = None

    def model_dump_mongo(self) -> dict:
        """Return a dict suitable for MongoDB insertion/update.

        Uses alias names (e.g., "_id" instead of "id") and excludes
        the id field if it is None.
        """
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data
