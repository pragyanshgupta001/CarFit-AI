"""FastAPI exception handlers returning standardized JSON error envelopes."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions import AppError, AuthorizationError, LLMError, MCPError


def _error_envelope(
    code: str,
    message: str,
    details: Any = None,
) -> dict:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        "meta": {"request_id": None},
    }


def register_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers for all custom exception types."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(
                code=exc.__class__.__name__,
                message=exc.message,
                details=exc.details,
            ),
        )

    @app.exception_handler(MCPError)
    async def mcp_error_handler(request: Request, exc: MCPError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(
                code="MCPError",
                message=exc.message,
                details=exc.details,
            ),
        )

    @app.exception_handler(LLMError)
    async def llm_error_handler(request: Request, exc: LLMError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(
                code="LLMError",
                message=exc.message,
                details=exc.details,
            ),
        )

    @app.exception_handler(AuthorizationError)
    async def authorization_error_handler(
        request: Request, exc: AuthorizationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(
                code="AuthorizationError",
                message=exc.message,
                details=exc.details,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=_error_envelope(
                code="InternalError",
                message="An unexpected error occurred",
                details=str(exc),
            ),
        )
