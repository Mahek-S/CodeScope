from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str
    database_url_sync: str

    # Redis
    redis_url: str

    # GitHub
    github_client_id: str
    github_client_secret: str
    github_webhook_secret: str

    # LLM
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None

    # Session
    secret_key: str
    session_cookie_name: str="codescope_session"

    token_encryption_key: str


settings = Settings()
