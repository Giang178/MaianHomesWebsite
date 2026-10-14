import base64
import json
import re
from typing import Any, Literal

from dotenv import load_dotenv
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.release_identity import baked_image_revision

# Load .env explicitly to ensure environment variables are available
load_dotenv()

class Settings(BaseSettings):
    APP_RELEASE: str = Field(default="development", validation_alias="APP_RELEASE")
    LOAD_TEST_TARGET_MARKER: str = Field(
        default="", validation_alias="LOAD_TEST_TARGET_MARKER"
    )
    # API Settings
    API_PORT: int = Field(default=8000, validation_alias="API_PORT")
    ENVIRONMENT: str = Field(default="development", validation_alias="ENVIRONMENT")
    DEPLOYMENT_TIER: Literal["development", "staging", "production"] = Field(
        default="development", validation_alias="DEPLOYMENT_TIER"
    )
    DEPLOYMENT_INSTANCE_ID: str = Field(
        default="development", validation_alias="DEPLOYMENT_INSTANCE_ID"
    )
    
    # MongoDB Settings
    MONGODB_URL: str = Field(default="mongodb://127.0.0.1:27017", validation_alias="MONGODB_URL")
    DATABASE_NAME: str = Field(default="maian_homes", validation_alias="DATABASE_NAME")
    
    # AI provider settings. Gemini is selected explicitly in staging/production;
    # Ollama remains available for local development and rollback.
    AI_PROVIDER: Literal["ollama", "gemini"] = Field(
        default="ollama", validation_alias="AI_PROVIDER"
    )
    GEMINI_API_KEY: str = Field(default="", validation_alias="GEMINI_API_KEY")
    GEMINI_MODEL: str = Field(
        default="gemini-3.5-flash-lite", validation_alias="GEMINI_MODEL"
    )
    GEMINI_REQUIRED: bool = Field(default=False, validation_alias="GEMINI_REQUIRED")
    GEMINI_HEALTH_TIMEOUT_SECONDS: int = Field(
        default=5, validation_alias="GEMINI_HEALTH_TIMEOUT_SECONDS"
    )
    GEMINI_REQUEST_TIMEOUT_SECONDS: float = Field(
        default=30.0,
        ge=5.0,
        le=120.0,
        validation_alias="GEMINI_REQUEST_TIMEOUT_SECONDS",
    )
    # Ollama Settings
    OLLAMA_MODEL: str = Field(
        default="qwen3:4b-instruct-2507-q4_K_M", validation_alias="OLLAMA_MODEL"
    )
    OLLAMA_HOST: str = Field(default="http://localhost:11434", validation_alias="OLLAMA_HOST")
    OLLAMA_REQUIRED: bool = Field(default=False, validation_alias="OLLAMA_REQUIRED")
    OLLAMA_HEALTH_TIMEOUT_SECONDS: int = Field(
        default=5, validation_alias="OLLAMA_HEALTH_TIMEOUT_SECONDS"
    )
    MAYA_GROUNDED_CHAT_ENABLED: bool = Field(
        default=False, validation_alias="MAYA_GROUNDED_CHAT_ENABLED"
    )
    MAYA_LOCAL_SESSION_FALLBACK_ENABLED: bool = Field(
        default=False, validation_alias="MAYA_LOCAL_SESSION_FALLBACK_ENABLED"
    )
    MARKETING_TRANSACTIONS_ENABLED: bool = Field(default=False, validation_alias="MARKETING_TRANSACTIONS_ENABLED")
    MARKETING_WORKFLOW_ENABLED: bool = Field(default=True, validation_alias="MARKETING_WORKFLOW_ENABLED")
    MARKETING_PROVISIONAL_DRAFT_HOURS: int = Field(default=24, validation_alias="MARKETING_PROVISIONAL_DRAFT_HOURS")
    MARKETING_ORPHAN_MEDIA_HOURS: int = Field(default=168, validation_alias="MARKETING_ORPHAN_MEDIA_HOURS")
    PUBLIC_SITE_URL: str = Field(
        default="https://maianhomes.vn",
        validation_alias="PUBLIC_SITE_URL",
        description="Canonical public website origin used by Marketing metadata",
    )
    MARKETING_REVALIDATE_URL: str = Field(
        default="http://127.0.0.1:3000/api/webhook/revalidate",
        description="URL of the Next.js marketing revalidation endpoint",
    )
    MARKETING_REVALIDATE_SECRET: str = Field(
        default="change-me-local-marketing-revalidation",
        validation_alias="MARKETING_REVALIDATE_SECRET",
    )
    ACTIVITY_EMBEDDED_JOBS: bool = Field(default=True, validation_alias="ACTIVITY_EMBEDDED_JOBS")
    MARKETING_EMBEDDED_JOBS: bool = Field(default=True, validation_alias="MARKETING_EMBEDDED_JOBS")
    NOTIFICATIONS_REALTIME_ENABLED: bool = Field(
        default=False, validation_alias="NOTIFICATIONS_REALTIME_ENABLED"
    )
    WS_ALLOW_QUERY_TOKEN: bool = Field(default=True, validation_alias="WS_ALLOW_QUERY_TOKEN")
    WS_SESSION_RECHECK_SECONDS: int = Field(
        default=60,
        ge=15,
        le=300,
        validation_alias="WS_SESSION_RECHECK_SECONDS",
    )
    NOTIFICATIONS_CHANNEL: str = Field(
        default="maian:notifications", validation_alias="NOTIFICATIONS_CHANNEL"
    )
    NOTIFICATIONS_REALTIME_CANARY_IDS: str = Field(
        default="", validation_alias="NOTIFICATIONS_REALTIME_CANARY_IDS"
    )
    PUBLIC_LEAD_RATE_LIMIT: str = Field(default="120/second", validation_alias="PUBLIC_LEAD_RATE_LIMIT")
    PUBLIC_LEAD_FINGERPRINT_RATE_LIMIT: str = Field(
        default="10/minute", validation_alias="PUBLIC_LEAD_FINGERPRINT_RATE_LIMIT"
    )
    REDIS_URL: str = Field(default="redis://127.0.0.1:6379/0", validation_alias="REDIS_URL")
    REDIS_MAX_CONNECTIONS: int = Field(
        default=64,
        ge=8,
        le=512,
        validation_alias="REDIS_MAX_CONNECTIONS",
    )
    REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS: float = Field(
        default=3.0,
        ge=0.1,
        le=30.0,
        validation_alias="REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS",
    )
    REDIS_POOL_WAIT_TIMEOUT_SECONDS: float = Field(
        default=2.0,
        ge=0.1,
        le=30.0,
        validation_alias="REDIS_POOL_WAIT_TIMEOUT_SECONDS",
    )
    RATE_LIMIT_STORAGE_URI: str = Field(default="memory://", validation_alias="RATE_LIMIT_STORAGE_URI")
    TRUSTED_PROXY_CIDRS: str = Field(
        default="127.0.0.1/32,::1/128", validation_alias="TRUSTED_PROXY_CIDRS"
    )
    CSRF_ORIGIN_ENFORCEMENT: bool = Field(
        default=False, validation_alias="CSRF_ORIGIN_ENFORCEMENT"
    )
    METRICS_ALLOWED_CIDRS: str = Field(
        default="127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16",
        validation_alias="METRICS_ALLOWED_CIDRS",
    )
    METRICS_TOKEN: str = Field(default="", validation_alias="METRICS_TOKEN")
    MONGODB_MAX_POOL_SIZE: int = Field(default=40, validation_alias="MONGODB_MAX_POOL_SIZE")
    MONGODB_MIN_POOL_SIZE: int = Field(default=5, validation_alias="MONGODB_MIN_POOL_SIZE")
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: int = Field(
        default=5000,
        ge=500,
        le=30000,
        validation_alias="MONGODB_SERVER_SELECTION_TIMEOUT_MS",
    )
    MONGODB_CONNECT_TIMEOUT_MS: int = Field(
        default=3000,
        ge=500,
        le=30000,
        validation_alias="MONGODB_CONNECT_TIMEOUT_MS",
    )
    MONGODB_SOCKET_TIMEOUT_MS: int = Field(
        default=15000,
        ge=1000,
        le=120000,
        validation_alias="MONGODB_SOCKET_TIMEOUT_MS",
    )
    MONGODB_WAIT_QUEUE_TIMEOUT_MS: int = Field(
        default=2000,
        ge=100,
        le=30000,
        validation_alias="MONGODB_WAIT_QUEUE_TIMEOUT_MS",
    )
    ENSURE_INDEXES_ON_STARTUP: bool = Field(default=False, validation_alias="ENSURE_INDEXES_ON_STARTUP")
    ACCOUNT_CREDENTIAL_DELIVERY_ENABLED: bool = Field(
        default=True, validation_alias="ACCOUNT_CREDENTIAL_DELIVERY_ENABLED"
    )
    PASSWORD_RESET_ENABLED: bool = Field(default=True, validation_alias="PASSWORD_RESET_ENABLED")
    ENFORCE_FIRST_LOGIN_CHANGE: bool = Field(
        default=True, validation_alias="ENFORCE_FIRST_LOGIN_CHANGE"
    )
    CREDENTIAL_CANARY_EMAILS: str = Field(default="", validation_alias="CREDENTIAL_CANARY_EMAILS")
    WORKER_HEALTH_REQUIRED: bool = Field(default=False, validation_alias="WORKER_HEALTH_REQUIRED")
    WORKER_HEARTBEAT_MAX_AGE_SECONDS: int = Field(
        default=120, validation_alias="WORKER_HEARTBEAT_MAX_AGE_SECONDS"
    )
    CREDENTIAL_ENCRYPTION_KEY: str = Field(default="", validation_alias="CREDENTIAL_ENCRYPTION_KEY")
    CREDENTIAL_ENCRYPTION_KEY_VERSION: int = Field(
        default=1, validation_alias="CREDENTIAL_ENCRYPTION_KEY_VERSION"
    )
    CREDENTIAL_DECRYPTION_KEYS: str = Field(
        default="{}", validation_alias="CREDENTIAL_DECRYPTION_KEYS"
    )
    S3_ENABLED: bool = Field(default=False, validation_alias="S3_ENABLED")
    S3_ENDPOINT_URL: str = Field(default="http://127.0.0.1:9000", validation_alias="S3_ENDPOINT_URL")
    S3_ACCESS_KEY: str = Field(default="", validation_alias="S3_ACCESS_KEY")
    S3_SECRET_KEY: str = Field(default="", validation_alias="S3_SECRET_KEY")
    S3_BUCKET: str = Field(default="maian-sales", validation_alias="S3_BUCKET")
    S3_REGION: str = Field(default="ap-southeast-1", validation_alias="S3_REGION")
    S3_MAX_POOL_CONNECTIONS: int = Field(
        default=64,
        ge=10,
        le=512,
        validation_alias="S3_MAX_POOL_CONNECTIONS",
    )
    S3_MAX_CONCURRENCY: int = Field(
        default=32,
        ge=1,
        le=256,
        validation_alias="S3_MAX_CONCURRENCY",
    )
    S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS: float = Field(
        default=2.0,
        ge=0.1,
        le=30.0,
        validation_alias="S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS",
    )
    
    # Upload Settings
    UPLOAD_DIR: str = Field(default="uploads", validation_alias="UPLOAD_DIR")
    
    MALWARE_SCAN_ENABLED: bool = Field(default=False, validation_alias="MALWARE_SCAN_ENABLED")
    CLAMAV_HOST: str = Field(default="127.0.0.1", validation_alias="CLAMAV_HOST")
    CLAMAV_PORT: int = Field(default=3310, validation_alias="CLAMAV_PORT")
    CLAMAV_TIMEOUT_SECONDS: int = Field(
        default=30, validation_alias="CLAMAV_TIMEOUT_SECONDS"
    )
    CONSIGNMENT_ENABLED: bool = Field(
        default=True,
        validation_alias="CONSIGNMENT_ENABLED",
    )

    # Security Settings
    BCRYPT_MAX_WORKERS: int = Field(
        default=2,
        ge=1,
        le=8,
        validation_alias="BCRYPT_MAX_WORKERS",
    )
    CEO_PROTECTED_EMAIL: str = Field(default="admin@maianhomes.com", validation_alias="CEO_PROTECTED_EMAIL")
    CEO_EMAIL: str = Field(default="admin@maianhomes.com", validation_alias="CEO_EMAIL")
    CEO_BOOTSTRAP_PASSWORD: str = Field(default="", validation_alias="CEO_BOOTSTRAP_PASSWORD")
    
    # Email / SMTP Settings
    SMTP_HOST: str = Field(default="smtp.gmail.com", validation_alias="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, validation_alias="SMTP_PORT")
    SMTP_START_TLS: bool = Field(default=True, validation_alias="SMTP_START_TLS")
    SMTP_USER: str = Field(default="", validation_alias="SMTP_USER")
    SMTP_PASSWORD: str = Field(default="", validation_alias="SMTP_PASSWORD")
    SMTP_FROM_NAME: str = Field(default="Maian Homes", validation_alias="SMTP_FROM_NAME")
    SMTP_FROM_EMAIL: str = Field(default="", validation_alias="SMTP_FROM_EMAIL")
    ADMIN_LOGIN_URL: str = Field(default="http://localhost:3000/login", validation_alias="ADMIN_LOGIN_URL")
    ADMIN_RESET_URL: str = Field(default="http://localhost:3000/reset-password", validation_alias="ADMIN_RESET_URL")
    ADMIN_SETUP_URL: str = Field(default="http://localhost:3000/setup-account", validation_alias="ADMIN_SETUP_URL")
    SYSTEM_MONITOR_FRONTEND_URL: str = Field(default="http://localhost:3000", validation_alias="SYSTEM_MONITOR_FRONTEND_URL")
    SYSTEM_MONITOR_BACKEND_URL: str = Field(default="http://api1:8000/health/live", validation_alias="SYSTEM_MONITOR_BACKEND_URL")
    SYSTEM_MONITOR_API_URL: str = Field(default="http://api1:8000/health/ready", validation_alias="SYSTEM_MONITOR_API_URL")
    SYSTEM_MONITOR_DOMAIN: str = Field(default="", validation_alias="SYSTEM_MONITOR_DOMAIN")
    SYSTEM_MONITOR_TIMEOUT_SECONDS: int = Field(default=8, validation_alias="SYSTEM_MONITOR_TIMEOUT_SECONDS")
    SYSTEM_MONITOR_INTERVAL_SECONDS: int = Field(default=60, validation_alias="SYSTEM_MONITOR_INTERVAL_SECONDS")
    SYSTEM_MONITOR_REQUIRED: bool = Field(default=False, validation_alias="SYSTEM_MONITOR_REQUIRED")
    SYSTEM_MONITOR_EXPECTED_WORKERS: str = Field(default="activity-worker,system-monitor-worker", validation_alias="SYSTEM_MONITOR_EXPECTED_WORKERS")
    
    # JWT Settings — CRITICAL: MUST be set in .env. App will crash if missing.
    SECRET_KEY: str = Field(default="", validation_alias="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=480, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES") # 8 hours

    # CORS Settings - Robust parsing for string, comma-separated string, or list from .env
    ALLOWED_ORIGINS: list[str] | str = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.46:3000", "http://192.168.1.132:3000", "http://192.168.1.57:3000", "http://192.168.1.133:3000", "http://172.16.100.37:3000", "http://172.16.100.137:3000", "https://maianhomes.vn", "https://admin.maianhomes.vn"],
        validation_alias="ALLOWED_ORIGINS"
    )

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("SECRET_KEY is missing or empty in .env configuration. Please configure SECRET_KEY before starting the application.")
        return v

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if v is None:
            return ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.46:3000", "http://192.168.1.132:3000", "http://192.168.1.57:3000", "http://192.168.1.133:3000", "http://172.16.100.37:3000", "http://172.16.100.137:3000", "https://maianhomes.vn", "https://admin.maianhomes.vn"]
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped:
                return ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.46:3000", "http://192.168.1.132:3000", "http://192.168.1.57:3000", "http://192.168.1.133:3000", "http://172.16.100.37:3000", "http://172.16.100.137:3000", "https://maianhomes.vn", "https://admin.maianhomes.vn"]
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(i).strip() for i in parsed if str(i).strip()]
                except Exception:
                    pass
            return [i.strip() for i in v_stripped.split(",") if i.strip()]
        return ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.46:3000", "http://192.168.1.132:3000", "http://192.168.1.57:3000", "http://192.168.1.133:3000", "http://172.16.100.37:3000", "https://maianhomes.vn", "https://admin.maianhomes.vn"]

    @model_validator(mode="after")
    def validate_production_safety(self):
        placeholder_tokens = ("replace-", "change-me", "changeme", "minioadmin")

        def is_placeholder(value: str) -> bool:
            normalized = (value or "").strip().casefold()
            return not normalized or any(token in normalized for token in placeholder_tokens)

        marker = self.LOAD_TEST_TARGET_MARKER.strip()
        if self.DEPLOYMENT_TIER == "production" and marker:
            raise ValueError("Production deployment tier requires an empty LOAD_TEST_TARGET_MARKER")
        if self.DEPLOYMENT_TIER == "staging" and is_placeholder(marker):
            raise ValueError(
                "Staging deployment tier requires a non-placeholder LOAD_TEST_TARGET_MARKER"
            )
        if self.ENVIRONMENT.casefold() != "production":
            if self.DEPLOYMENT_TIER != "development":
                raise ValueError(
                    "Staging and production deployment tiers require ENVIRONMENT=production"
                )
            return self
        if self.DEPLOYMENT_TIER not in {"staging", "production"}:
            raise ValueError(
                "Production-mode ENVIRONMENT requires DEPLOYMENT_TIER=staging or production"
            )

        deployment_instance = self.DEPLOYMENT_INSTANCE_ID.strip()
        if (
            is_placeholder(deployment_instance)
            or deployment_instance.casefold() in {"development", "production", "staging"}
            or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{2,63}", deployment_instance)
        ):
            raise ValueError(
                "Staging and production require an explicit deployment instance identifier"
            )

        release = self.APP_RELEASE.strip()
        mutable_release_names = {
            "dev",
            "development",
            "latest",
            "main",
            "master",
            "production",
            "staging",
            "unknown",
        }
        if is_placeholder(release) or release.casefold() in mutable_release_names:
            raise ValueError(
                "Staging and production require a non-placeholder immutable APP_RELEASE"
            )
        image_revision = baked_image_revision()
        if image_revision and release != image_revision:
            raise ValueError(
                "APP_RELEASE must match the immutable revision baked into the backend image"
            )

        if len(self.SECRET_KEY) < 48 or is_placeholder(self.SECRET_KEY):
            raise ValueError("Production SECRET_KEY must contain at least 48 random characters")
        if "*" in self.ALLOWED_ORIGINS or any(not origin.startswith("https://") for origin in self.ALLOWED_ORIGINS):
            raise ValueError("Production ALLOWED_ORIGINS must contain explicit HTTPS origins")
        if not self.CSRF_ORIGIN_ENFORCEMENT:
            raise ValueError("Production cookie-authenticated mutations require Origin enforcement")
        if not self.MARKETING_TRANSACTIONS_ENABLED:
            raise ValueError("Production Marketing requires MongoDB transactions")
        if self.MARKETING_EMBEDDED_JOBS:
            raise ValueError("Production Marketing requires the external worker")
        if not self.MARKETING_REVALIDATE_URL or is_placeholder(self.MARKETING_REVALIDATE_SECRET):
            raise ValueError("Production Marketing revalidation URL and secret are required")
        if not self.CONSIGNMENT_ENABLED:
            raise ValueError("Production must use Consignment; legacy F2 mutations are disabled")
        if self.ENSURE_INDEXES_ON_STARTUP:
            raise ValueError("Production indexes must be created by database-bootstrap, not at API startup")
        if not self.WORKER_HEALTH_REQUIRED or self.ACTIVITY_EMBEDDED_JOBS:
            raise ValueError(
                "Production requires the external Activity worker and heartbeat readiness checks"
            )
        if not self.RATE_LIMIT_STORAGE_URI.startswith("redis://"):
            raise ValueError("Production rate limiting must use Redis")
        if self.NOTIFICATIONS_REALTIME_ENABLED and not self.REDIS_URL.startswith(("redis://", "rediss://")):
            raise ValueError("Realtime notifications require Redis")
        if self.WS_ALLOW_QUERY_TOKEN:
            raise ValueError("Production WebSocket authentication must use the HttpOnly cookie")
        if not self.S3_ENABLED:
            raise ValueError("Production object storage must use S3/MinIO")
        if self.S3_ENABLED and (is_placeholder(self.S3_ACCESS_KEY) or is_placeholder(self.S3_SECRET_KEY)):
            raise ValueError("Production object storage credentials are missing or use placeholders")
        if not self.SYSTEM_MONITOR_REQUIRED:
            raise ValueError("Production requires the system monitoring worker")
        if not self.MALWARE_SCAN_ENABLED:
            raise ValueError("Production file uploads require malware scanning")
        if self.AI_PROVIDER == "gemini":
            if not self.GEMINI_REQUIRED:
                raise ValueError("Production requires Gemini readiness checks")
            if is_placeholder(self.GEMINI_API_KEY) or is_placeholder(self.GEMINI_MODEL):
                raise ValueError("Production Gemini API key and model are required")
        else:
            if not self.OLLAMA_REQUIRED:
                raise ValueError("Production requires Ollama readiness checks")
            ollama_host = self.OLLAMA_HOST.strip().casefold()
            if (
                not ollama_host.startswith(("http://", "https://"))
                or "localhost" in ollama_host
                or "127.0.0.1" in ollama_host
                or is_placeholder(self.OLLAMA_MODEL)
            ):
                raise ValueError(
                    "Production Ollama host must be an explicit service URL and model"
                )
        if self.ACCOUNT_CREDENTIAL_DELIVERY_ENABLED or self.PASSWORD_RESET_ENABLED:
            if self.SMTP_PORT == 587 and not self.SMTP_START_TLS:
                raise ValueError("SMTP port 587 requires STARTTLS")
            managed_urls = [self.ADMIN_LOGIN_URL]
            if self.ACCOUNT_CREDENTIAL_DELIVERY_ENABLED:
                managed_urls.append(self.ADMIN_SETUP_URL)
            if self.PASSWORD_RESET_ENABLED:
                managed_urls.append(self.ADMIN_RESET_URL)
            if any(
                not url.startswith("https://")
                or "localhost" in url.casefold()
                or "127.0.0.1" in url
                for url in managed_urls
            ):
                raise ValueError(
                    "Production credential delivery URLs must use explicit HTTPS URLs on non-local hosts"
                )

            try:
                raw_key = base64.urlsafe_b64decode(
                    self.CREDENTIAL_ENCRYPTION_KEY + "=" * (-len(self.CREDENTIAL_ENCRYPTION_KEY) % 4)
                )
            except Exception as exc:
                raise ValueError("CREDENTIAL_ENCRYPTION_KEY is not valid URL-safe base64") from exc
            if len(raw_key) != 32:
                raise ValueError("CREDENTIAL_ENCRYPTION_KEY must encode exactly 32 bytes")
        return self

    @property
    def credential_canary_emails(self) -> set[str]:
        return {value.strip().casefold() for value in self.CREDENTIAL_CANARY_EMAILS.split(",") if value.strip()}

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
