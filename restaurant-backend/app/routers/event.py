from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from fastapi import UploadFile, File
from app.database import get_db
from app import models, schemas
from app.deps.admin import admin_guard
router = APIRouter(prefix="/events", tags=["Events"])
import uuid
from supabase import create_client
import os

# Pastikan URL berakhir dengan slash jika library memintanya
SUPABASE_URL = os.getenv("SUPABASE_URL")
if SUPABASE_URL and not SUPABASE_URL.endswith("/"):
    SUPABASE_URL += "/"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 2 * 1024 * 1024
BUCKET = "menu-images"  # 🔥 samakan



# ======================================================
# UPLOAD IMAGE
# ======================================================
@router.post(
    "/upload",
    dependencies=[Depends(admin_guard)],
    status_code=201
)
async def upload_event_image(file: UploadFile = File(...)):
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

    public_url = supabase.storage.from_(BUCKET).get_public_url(filename)

    return {
        "url": public_url   # 🔥 SAMAKAN DENGAN LOCATION
    }



def resolve_status(start_date: date, end_date: date) -> str:
    today = date.today()

    if today < start_date:
        return "upcoming"
    elif start_date <= today <= end_date:
        return "ongoing"
    return "past"
# ======================================================
# READ
# ======================================================
@router.get("/", response_model=list[schemas.EventResponse])
def get_events(
    db: Session = Depends(get_db)
):
    return (
        db.query(models.Event)
        .filter(models.Event.is_active.is_(True))
        .order_by(models.Event.start_date.asc())
        .all()
    )

@router.get("/filter", response_model=list[schemas.EventResponse])
def get_events_by_status(
    status: str,
    db: Session = Depends(get_db)
):
    if status not in {"upcoming", "ongoing", "past"}:
        raise HTTPException(400, "Invalid status")

    return (
        db.query(models.Event)
        .filter(
            models.Event.is_active.is_(True),
            models.Event.status == status
        )
        .order_by(models.Event.start_date.asc())
        .all()
    )

# ======================================================
# CREATE
# ======================================================
@router.post(
    "/",
    response_model=schemas.EventResponse,
    dependencies=[Depends(admin_guard)]
)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db)
):
    if event.end_date < event.start_date:
        raise HTTPException(400, "End date must be after start date")

    if not event.cover_image:
        raise HTTPException(
            status_code=400,
            detail="cover_image is required. Upload image first."
        )

    status = resolve_status(event.start_date, event.end_date)

    db_event = models.Event(
        title=event.title,
        description=event.description,
        start_date=event.start_date,
        end_date=event.end_date,
        detail_link=str(event.detail_link) if event.detail_link else None,
        cover_image=event.cover_image,
        is_featured=event.is_featured or False,
        status=status
    )

    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


# ======================================================
# UPDATE
# ======================================================
@router.put(
    "/{event_id}",
    response_model=schemas.EventResponse,
    dependencies=[Depends(admin_guard)]
)
def update_event(
    event_id: int,
    event: schemas.EventUpdate,
    db: Session = Depends(get_db)
):
    db_event = db.query(models.Event).filter(
        models.Event.id == event_id
    ).first()

    if not db_event:
        raise HTTPException(404, "Event not found")

    data = event.dict(exclude_unset=True)

    for key, value in data.items():
        if key == "detail_link" and value is not None:
            setattr(db_event, key, str(value))  # 🔥 FIX UTAMA
        else:
            setattr(db_event, key, value)

        setattr(db_event, key, value)

    if "start_date" in data or "end_date" in data:
        start = data.get("start_date", db_event.start_date)
        end = data.get("end_date", db_event.end_date)

        if end < start:
            raise HTTPException(400, "Invalid date range")

        db_event.status = resolve_status(start, end)

    db.commit()
    db.refresh(db_event)
    return db_event

# ======================================================
# DELETE
# ======================================================
@router.delete(
    "/{event_id}",
    dependencies=[Depends(admin_guard)]
)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db)
):
    db_event = db.query(models.Event).filter(
        models.Event.id == event_id
    ).first()

    if not db_event:
        raise HTTPException(404, "Event not found")

    db_event.is_active = False
    db.commit()
    return {"status": "deleted"}

@router.get("/admin/check")
def admin_check(dep=Depends(admin_guard)):
    return {"ok": True}
