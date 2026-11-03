"""Pydantic model matching the existing Mongoose Listing.js schema.

Field names preserve the camelCase naming used by MongoDB documents.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.base import BaseDocument


class Listing(BaseDocument):
    """Car listing document matching Mongoose Listing.js schema."""

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )

    listingId: str
    transactionType: str = Field(..., pattern=r"^(rent|buy)$")
    brand: str
    model: str
    category: str
    location: str
    dailyPrice: Optional[float] = Field(default=None, ge=0)
    purchasePrice: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="INR", pattern=r"^(INR|USD)$")
    seats: int = Field(..., ge=1)
    fuelType: str
    transmission: str
    features: list[str] = Field(default_factory=list)
    availableFrom: datetime
    availableTo: datetime
    rating: float = Field(..., ge=0, le=5)
    provider: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    id: Any = Field(default=None, alias="_id")
