"""Central configuration, read once from environment / backend/.env."""
import os
import re
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
# Inspection photos. On a server, point this at the persistent disk (e.g. /var/data/uploads).
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# --- Gemini -----------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# Vision model used to read labels. "gemini-flash-latest" always points at the
# current Flash release, so the app does not break when a version is retired.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
# Tried in order when the main model is overloaded (503) or rate-limited (429).
GEMINI_FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash,gemini-3-flash-preview,gemini-flash-lite-latest").split(",")
    if m.strip() and m.strip() != GEMINI_MODEL
]

# --- Rules corpus -------------------------------------------------------------
RULES_PDF_PATH = Path(os.getenv("RULES_PDF_PATH", str(PROJECT_DIR / "sih_eng.pdf")))
RULES_CORPUS_PATH = DATA_DIR / "rules_corpus.json"

# --- Database -----------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'compliance.db').as_posix()}").strip()
# Neon / Render hand out postgres:// or postgresql:// URLs; use the psycopg (v3) driver for them
DATABASE_URL = re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", DATABASE_URL)

# --- Auth ---------------------------------------------------------------------
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "official@metrology.gov.in").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = os.getenv("ADMIN_NAME", "State Controller")
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "12"))
# "Sign in with Google" OAuth client ID (Google Cloud console). Empty disables Google sign-in.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _load_secret() -> str:
    """Use SECRET_KEY from env, else a random key persisted to data/ so sessions survive restarts."""
    env_secret = os.getenv("SECRET_KEY", "").strip()
    if env_secret:
        return env_secret
    secret_file = DATA_DIR / ".secret_key"
    if secret_file.exists():
        return secret_file.read_text().strip()
    secret = secrets.token_hex(32)
    secret_file.write_text(secret)
    return secret


SECRET_KEY = _load_secret()

# --- HTTP ---------------------------------------------------------------------
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))
MAX_IMAGES = 4  # photos per scan (front, back, sides)

# Letterhead printed on show-cause notices
OFFICE_NAME = os.getenv("OFFICE_NAME", "Office of the Controller of Legal Metrology")
OFFICE_ADDRESS = os.getenv("OFFICE_ADDRESS", "Legal Metrology Department")

# Public complaint portal: submissions allowed per IP address per hour
COMPLAINTS_PER_HOUR = int(os.getenv("COMPLAINTS_PER_HOUR", "5"))

# --- Deployment -----------------------------------------------------------------
# Set PRAMITI_ENV=production on the server (through the host's secret/env settings, never in code).
# Startup then refuses the demo defaults below, which are fine on a laptop but unsafe online.
ENVIRONMENT = os.getenv("PRAMITI_ENV", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"


def check_production_settings():
    if not IS_PRODUCTION:
        return
    problems = []
    if not os.getenv("SECRET_KEY", "").strip():
        problems.append("SECRET_KEY must be set explicitly (a long random string), not auto-generated on disk")
    if ADMIN_PASSWORD in ("", "admin123"):
        problems.append("ADMIN_PASSWORD is the demo password - set a strong one")
    if any("localhost" in o or "127.0.0.1" in o for o in CORS_ORIGINS):
        problems.append("CORS_ORIGINS still allows localhost - set it to the real frontend URL")
    if not GEMINI_API_KEY:
        problems.append("GEMINI_API_KEY is not set")
    if problems:
        raise SystemExit("Refusing to start with PRAMITI_ENV=production:\n  - " + "\n  - ".join(problems))


# Optional Unicode TTF for PDF reports (needed to print Hindi/regional label text).
PDF_FONT_PATH = os.getenv("PDF_FONT_PATH", "").strip()
