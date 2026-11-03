"""Unit tests for application configuration (app/config.py)."""

from app.config import Settings


def test_settings_loads_defaults() -> None:
    """Settings should load with sensible defaults when no env vars are set."""
    settings = Settings()
    assert settings.environment == "development"
    assert settings.log_level == "INFO"
    assert settings.jwt_algorithm == "HS256"
    assert settings.access_token_expire_minutes == 30
    assert settings.ollama_url == "http://localhost:11434"
    assert settings.ollama_model == "qwen2.5:7b"
    assert settings.enable_ollama is False
    assert settings.client_url == "http://localhost:5173"
    assert settings.langfuse_host == "https://cloud.langfuse.com"


def test_settings_placeholder_fields_are_strings() -> None:
    """Placeholder fields should be str or Optional[str] types."""
    settings = Settings()
    assert isinstance(settings.mongo_uri, str)
    assert isinstance(settings.jwt_secret, str)
    assert isinstance(settings.groq_api_key, str | type(None))
    assert isinstance(settings.mcp_server_paths, str)


def test_settings_required_fields_can_be_set() -> None:
    """Required placeholder fields should accept values when provided."""
    settings = Settings(
        mongo_uri="mongodb://localhost:27017/car_market",
        jwt_secret="test-secret-key",
        groq_api_key="gsk_test",
    )
    assert settings.mongo_uri == "mongodb://localhost:27017/car_market"
    assert settings.jwt_secret == "test-secret-key"
    assert settings.groq_api_key == "gsk_test"


def test_settings_accepts_env_overrides() -> None:
    """Settings should accept explicit overrides for all configured fields."""
    settings = Settings(
        environment="production",
        log_level="DEBUG",
        jwt_secret="prod-secret",
        ollama_url="http://ollama.internal:11434",
        mcp_server_paths="roam-marketplace=./mcp/marketplace-server.js",
    )
    assert settings.environment == "production"
    assert settings.log_level == "DEBUG"
    assert settings.jwt_secret == "prod-secret"
    assert settings.ollama_url == "http://ollama.internal:11434"
    assert settings.mcp_server_paths == "roam-marketplace=./mcp/marketplace-server.js"
