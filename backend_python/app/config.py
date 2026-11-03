"""Centralized application configuration using Pydantic BaseSettings.

Loads environment variables from .env and the environment. Provides a typed
Settings object used throughout the application.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    log_level: str = "INFO"

    # MongoDB (required for Phase 3+)
    mongo_uri: str = ""

    # Authentication (required for Phase 4+)
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # LLM Providers
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"
    enable_ollama: bool = False
    ollama_model: str = "qwen2.5:7b"
    ollama_url: str = "http://localhost:11434"

    # MCP Server Paths (comma-separated: name=path)
    mcp_server_paths: str = ""

    # Observability (optional)
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str = "https://cloud.langfuse.com"

    # CORS
    client_url: str = "http://localhost:5173"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
