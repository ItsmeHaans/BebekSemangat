from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps.admin import admin_guard
from fastapi import UploadFile, File
import uuid
from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 2 * 1024 * 1024
BUCKET = "menu-images"  # 🔥 samakan




router = APIRouter(prefix="/locations", tags=["Locations"])


# ======================================================
# UPLOAD IMAGE
# ======================================================
@router.post(
    "/upload",
    dependencies=[Depends(admin_guard)],
    status_code=201
)
async def upload_location_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Invalid image type")

    if not file.filename or "." not in file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension")

    size = 0
    chunks = []

    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        chunks.append(chunk)

    content = b"".join(chunks)
    filename = f"{uuid.uuid4()}.{ext}"

    supabase = get_supabase()

    res = supabase.storage.from_(BUCKET).upload(
        filename,
        content,
        {
            "content-type": file.content_type,
            "cache-control": "31536000",
            "upsert": False
        }
    )
    if not res:
        raise HTTPException(500, "Upload failed")

    return {
        "url": supabase.storage.from_(BUCKET).get_public_url(filename)
    }



# ======================================================
# READ ALL
# ======================================================
@router.get("/", response_model=list[schemas.LocationOut])
def get_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).filter(
        models.Location.is_active.is_(True)
    ).all()



# ======================================================
# CREATE
# ======================================================
@router.post("/", response_model=schemas.LocationOut, dependencies=[Depends(admin_guard)])
def create_location(
    location: schemas.LocationCreate,
    db: Session = Depends(get_db)
):
    db_location = models.Location(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


# ======================================================
# UPDATE
# ======================================================
@router.put("/{location_id}", response_model=schemas.LocationOut, dependencies=[Depends(admin_guard)])
def update_location(
    location_id: int,
    location: schemas.LocationUpdate,  # ✅
    db: Session = Depends(get_db)
):
    db_location = db.query(models.Location).filter(
        models.Location.id == location_id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")

    for key, value in location.dict(exclude_unset=True).items():
        setattr(db_location, key, value)

    db.commit()
    db.refresh(db_location)
    return db_location



# ======================================================
# DELETE
# ======================================================
@router.delete("/{location_id}", dependencies=[Depends(admin_guard)])
def delete_location(
    location_id: int,
    db: Session = Depends(get_db)
):
    db_location = db.query(models.Location).filter(
        models.Location.id == location_id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")

    db_location.is_active = False
    db.commit()
    return {"status": "deleted"}

@router.get("/admin/check")
def admin_check(dep=Depends(admin_guard)):
    return {"ok": True}