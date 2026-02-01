import os
from typing import List


class Settings:
    app_name: str = os.getenv("APP_NAME", "نظام أرشفة وتحليل البيانات")
    app_env: str = os.getenv("APP_ENV", "development")

    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://docuser:docpass@postgres:5432/docdb",
    )

    cors_allow_origins: List[str] = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",")]

    jwt_secret: str = os.getenv("JWT_SECRET", "change-me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_access_expires: int = int(os.getenv("JWT_ACCESS_EXPIRES", "3600"))
    jwt_refresh_expires: int = int(os.getenv("JWT_REFRESH_EXPIRES", "1209600"))

    s3_endpoint_url: str = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
    s3_region: str = os.getenv("S3_REGION", "us-east-1")
    s3_access_key: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    s3_secret_key: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    s3_bucket: str = os.getenv("S3_BUCKET", "docs")
    s3_secure: bool = os.getenv("S3_SECURE", "false").lower() == "true"

    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    tesseract_langs: str = os.getenv("TESSERACT_LANGS", "ara+eng")

    # Local file storage root (Windows LAN path allowed)
    file_storage_root: str = os.getenv(
        "FILE_STORAGE_ROOT",
        r"D:\\مركز الاستشارات والتنمية",
    )

    # Local storage root inside container (bind-mounted to a host path via docker-compose)
    # Example host path on Windows: D:\\مركز الاستشارات والتنمية
    storage_root_path: str = os.getenv("STORAGE_ROOT", "/storage")


settings = Settings()


