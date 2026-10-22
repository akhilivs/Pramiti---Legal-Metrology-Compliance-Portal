from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

import batch_worker
import photo_store
from auth import ensure_default_users
from config import CORS_ORIGINS, GEMINI_API_KEY, GEMINI_MODEL, UPLOAD_DIR, check_production_settings
from database import SessionLocal, init_db
from rag_engine import get_retriever
from routers import admin, auth_routes, batches, complaints, insights, notices, scans

check_production_settings()
init_db()


class UploadFiles(StaticFiles):
    """Uploaded photos get random UUID names and are never rewritten, so browsers may cache them for good."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        ensure_default_users(db)
    finally:
        db.close()
    r = get_retriever()
    print(f"Rules index ready: {len(r.docs)} passages ({r.corpus_pages} Gazette pages transcribed).")
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY is not set - scanning will not work.")
    restored = photo_store.restore()
    if restored:
        print(f"Restored {restored} photos from the database.")
    batch_worker.ensure_worker()
    yield


app = FastAPI(title="Pramiti - Legal Metrology Compliance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# JSON lists (register, insights) compress ~5-10x
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.mount("/uploads", UploadFiles(directory=UPLOAD_DIR), name="uploads")

for r in (auth_routes, scans, batches, insights, notices, complaints, admin):
    app.include_router(r.router)


@app.get("/api/health")
def health_check():
    r = get_retriever()
    return {
        "status": "ok",
        "gemini_configured": bool(GEMINI_API_KEY),
        "model": GEMINI_MODEL,
        "rules_passages": len(r.docs),
        "gazette_pages_indexed": r.corpus_pages,
    }
