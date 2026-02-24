from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./marketing_reviewer.db"
    SECRET_KEY: str = "change-this-secret-key-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    ANTHROPIC_API_KEY: str = ""
    SLACK_BOT_TOKEN: str = ""
    NOTION_API_KEY: str = ""

    # CORS origins (comma-separated in env)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
