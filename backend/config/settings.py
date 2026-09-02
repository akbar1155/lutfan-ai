from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    ALLOW_DEV_LOGIN=(bool, False),
    ADMIN_LOGIN_USERNAME=(str, "admin"),
    ADMIN_LOGIN_PASSWORD=(str, "admin123"),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:5173"]),
    CSRF_TRUSTED_ORIGINS=(list, ["http://localhost:5173"]),
    RATE_LIMIT_GENERATIONS_PER_HOUR=(int, 3),
    RATE_LIMIT_GENERATIONS_PER_DAY=(int, 10),
)

environ.Env.read_env(ROOT_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="django-insecure-dev-only-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOW_DEV_LOGIN = env("ALLOW_DEV_LOGIN") or DEBUG
ADMIN_LOGIN_USERNAME = env("ADMIN_LOGIN_USERNAME")
ADMIN_LOGIN_PASSWORD = env("ADMIN_LOGIN_PASSWORD")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")
# Dev tunnels (ngrok / cloudflare / jprq): accept any Host while DEBUG is on.
if DEBUG and "*" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS = list(ALLOWED_HOSTS) + [
        ".ngrok-free.app",
        ".ngrok-free.dev",
        ".ngrok.app",
        ".ngrok.io",
        ".loca.lt",
        ".trycloudflare.com",
    ]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    # Local
    "apps.core",
    "apps.users",
    "apps.content",
    "apps.invitations",
    "apps.ai_engine",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.RequestIdMiddleware",
    "apps.core.middleware.BanCheckMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

AUTH_USER_MODEL = "users.User"

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
# Public Vite tunnel proxies /api — allow common tunnel origins in DEBUG.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    for origin in (
        "https://*.ngrok-free.app",
        "https://*.ngrok-free.dev",
        "https://*.ngrok.app",
        "https://*.ngrok.io",
        "http://*.ngrok-free.app",
        "http://*.ngrok.io",
    ):
        if origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS = list(CSRF_TRUSTED_ORIGINS) + [origin]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": False,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_ACCESS_SECRET", default=SECRET_KEY),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Lutfan AI API",
    "DESCRIPTION": "Premium digital invitation generation platform",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=DEBUG)

if CELERY_TASK_ALWAYS_EAGER:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "lutfan-local",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 280
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TASK_ALWAYS_EAGER = CELERY_TASK_ALWAYS_EAGER
CELERY_TASK_EAGER_PROPAGATES = True

TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
TELEGRAM_BOT_USERNAME = env("TELEGRAM_BOT_USERNAME", default="lutfan_ai_bot")

GOOGLE_AI_API_KEY = env("GOOGLE_AI_API_KEY", default="")
NANO_BANANA_MODEL = env("NANO_BANANA_MODEL", default="gemini-2.5-flash-image")

AWS_S3_ENDPOINT_URL = env("S3_ENDPOINT", default="http://localhost:9000")
AWS_S3_REGION_NAME = env("S3_REGION", default="us-east-1")
AWS_STORAGE_BUCKET_NAME_PUBLIC = env("S3_BUCKET_PUBLIC", default="lutfan-public")
AWS_STORAGE_BUCKET_NAME_PRIVATE = env("S3_BUCKET_PRIVATE", default="lutfan-private")
AWS_ACCESS_KEY_ID = env("S3_ACCESS_KEY", default="minioadmin")
AWS_SECRET_ACCESS_KEY = env("S3_SECRET_KEY", default="minioadmin")
CDN_BASE_URL = env("CDN_BASE_URL", default="http://localhost:9000/lutfan-public")
BACKEND_BASE_URL = env("BACKEND_BASE_URL", default="")

APP_BASE_URL = env("APP_BASE_URL", default="http://localhost:5173")
RATE_LIMIT_GENERATIONS_PER_HOUR = env("RATE_LIMIT_GENERATIONS_PER_HOUR")
RATE_LIMIT_GENERATIONS_PER_DAY = env("RATE_LIMIT_GENERATIONS_PER_DAY")

LOG_LEVEL = env("LOG_LEVEL", default="info").upper()
