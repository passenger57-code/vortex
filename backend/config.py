import os
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def _env(name, default=None, *, required=False):
    value = os.getenv(name, default)
    if value is not None and value.strip() != "":
        return value
    if required:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return default


def _db_url():
    url = os.getenv("DATABASE_URL", "")
    if not url:
        return "sqlite:///" + os.path.join(BASE_DIR, "vortex.db")
    if url.startswith("postgres://"):  # Heroku-style URLs
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):  # use the psycopg 3 driver (has Windows wheels)
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class Config:
    MEDIA_ROOT = os.getenv("MEDIA_ROOT", os.path.join(BASE_DIR, "media"))
    ENV = os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development"
    DEBUG = ENV == "development"
    SECRET_KEY = _env("SECRET_KEY", "dev-secret-change-me", required=(ENV not in {"development", "test"}))
    JWT_SECRET_KEY = _env("JWT_SECRET_KEY", "dev-jwt-secret-change-me-please-32b", required=(ENV not in {"development", "test"}))
    ADMIN_EMAIL = _env("ADMIN_EMAIL", "admin@vortex.local", required=(ENV not in {"development", "test"}))
    ADMIN_PASSWORD = _env("ADMIN_PASSWORD", "change-me-before-deploy", required=(ENV not in {"development", "test"}))
    REQUIRE_EMAIL_VERIFICATION = os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").strip().lower() in {"1", "true", "yes"}
    SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "").strip()
    APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173").rstrip("/")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    SUPABASE_PUBLIC_URL = os.getenv("SUPABASE_PUBLIC_URL", "").strip()
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "vortex-media")
    MEDIA_URL_TTL_SECONDS = int(os.getenv("MEDIA_URL_TTL_SECONDS", "14400"))
    TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()
    MEDIA_SCAN_ROOTS = [os.path.abspath(path.strip()) for path in os.getenv("MEDIA_SCAN_ROOTS", "").split(os.pathsep) if path.strip()]
    FFMPEG_BIN = os.getenv("FFMPEG_BIN", "ffmpeg").strip()
    STORAGE_PROVIDERS = ["local"] + (["supabase"] if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else [])
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=14)
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024 * 1024 + 1024 * 1024
    SQLALCHEMY_DATABASE_URI = _db_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    SESSION_COOKIE_SECURE = ENV == "production"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_SECURE = ENV == "production"
    JSON_SORT_KEYS = False
