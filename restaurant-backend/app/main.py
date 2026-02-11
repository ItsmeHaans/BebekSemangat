import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from .routers import menu, location, order, reservation, event
from fastapi import Request
from fastapi.responses import Response


# ======================================================
# ENVIRONMENT (WAJIB)
# ======================================================
ENV = os.getenv("ENV")

if ENV not in ("development", "production"):
    raise RuntimeError("ENV must be set to 'development' or 'production'")

# ======================================================
# APP INIT
# ======================================================
app = FastAPI(
    title="APS Restaurant API",
    debug=(ENV == "development")
)

# ======================================================
# SECURITY HEADERS
# ======================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ======================================================
# STATIC FILES (DEV ONLY / FALLBACK)
# ======================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

if ENV == "development" and os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# ======================================================
# CORS CONFIG
# ======================================================
if ENV == "development":
    ALLOWED_ORIGINS = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://localhost:63342",
        "http://127.0.0.1:63342"
    ]
else:
    ALLOWED_ORIGINS = [
        "https://kedaiamarta.com",
        "https://www.kedaiamarta.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================================================
# ROUTERS
# ======================================================
app.include_router(menu.router)
app.include_router(location.router)
app.include_router(order.router)
app.include_router(reservation.router)
app.include_router(event.router)


# ======================================================
# HEALTH CHECK
# ======================================================
@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}
