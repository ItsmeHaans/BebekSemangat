import os
import hmac
from fastapi import Header, HTTPException, status

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")

def admin_guard(
    x_api_key: str = Header(..., alias="X-API-Key")
):
    if not ADMIN_API_KEY:
        raise RuntimeError("ADMIN_API_KEY not set in environment")
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    if not hmac.compare_digest(x_api_key, ADMIN_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden"
        )
