"""Custom application exceptions.

All custom exceptions extend AppError and carry an HTTP status code and
optional details for standardized error responses.
"""

from typing import Any, Optional


class AppError(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class MCPError(AppError):
    """MCP server or tool execution error."""

    def __init__(
        self,
        message: str,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message, status_code=502, details=details)


class LLMError(AppError):
    """LLM provider error."""

    def __init__(
        self,
        message: str,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message, status_code=502, details=details)


class AuthorizationError(AppError):
    """Authorization error."""

    def __init__(
        self,
        message: str,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message, status_code=403, details=details)
