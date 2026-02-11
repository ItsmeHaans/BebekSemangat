from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
import uuid
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from supabase import create_client
from app.deps.admin import admin_guard
from fastapi import Depends
from fastapi import status

router = APIRouter(prefix="/menu", tags=["Menu"])

# ======================================================
# SUPABASE CONFIG (NO FALLBACK!)
# ======================================================
from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase env not configured"
        )

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)




ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp"
}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB
BUCKET = "menu-images"


# ======================================================
# UPLOAD IMAGE (ADMIN ONLY)
# ======================================================
@router.post(
    "/upload",
    dependencies=[Depends(admin_guard)],
    status_code=status.HTTP_201_CREATED
)

async def upload_image(file: UploadFile = File(...)):
    print("SUPABASE_URL =", SUPABASE_URL)
    print("SUPABASE_SERVICE_KEY =", SUPABASE_SERVICE_KEY[:10])

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Invalid image type")

    size = 0
    chunks = []

    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        chunks.append(chunk)

    content = b"".join(chunks)
    original_name = file.filename
    if not file.filename or "." not in file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    ext = file.filename.rsplit(".", 1)[-1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension")

    filename = f"{uuid.uuid4()}.{ext}"

    supabase = get_supabase()

    try:
        supabase.storage.from_(BUCKET).upload(
            filename,
            content,
            {
                "content-type": file.content_type,
                "cache-control": "3600",
                "upsert": False
            }
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to upload image"
        )

    public_url = supabase.storage.from_(BUCKET).get_public_url(filename)
    return {"url": public_url}


# ======================================================
# READ (GROUPED FOR FRONTEND)
# ======================================================
from sqlalchemy.orm import joinedload

@router.get("/")
def get_menu(db: Session = Depends(get_db)):
    items = (
        db.query(models.MenuItem)
        .options(joinedload(models.MenuItem.category))
        .filter(models.MenuItem.is_active.is_(True))
        .order_by(models.MenuItem.id.asc())
        .all()
    )

    result = {}
    for item in items:
        cat = item.category.name if item.category else "Uncategorized"
        result.setdefault(cat, []).append({
            "id": item.id,
            "title": item.title,
            "desc": item.description,
            "price": item.price,
            "image": item.image_url
        })

    return result



# ======================================================
# CREATE
# ======================================================
@router.post("/", dependencies=[Depends(admin_guard)])
def create_menu(
        menu: schemas.MenuCreate,
        db: Session = Depends(get_db)
):
    # Find or create category
    category = db.query(models.MenuCategory).filter(
        models.MenuCategory.name == menu.category
    ).first()

    if not category:
        category = models.MenuCategory(name=menu.category)
        db.add(category)
        db.commit()
        db.refresh(category)

    item = models.MenuItem(
        title=menu.title,
        description=menu.desc,  # Now correctly mapping 'desc' from schema
        price=menu.price,
        image_url=menu.image_url,
        category_id=category.id
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return {"status": "created", "id": item.id}


# ======================================================
# UPDATE
# ======================================================
@router.put("/{menu_id}", dependencies=[Depends(admin_guard)])
def update_menu(
    menu_id: int,
    menu: schemas.MenuUpdate,
    db: Session = Depends(get_db)
):
    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == menu_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if menu.category:
        category = db.query(models.MenuCategory).filter(
            models.MenuCategory.name == menu.category
        ).first()
        if not category:
            category = models.MenuCategory(name=menu.category)
            db.add(category)
            db.commit()
            db.refresh(category)
        item.category_id = category.id

    if menu.title is not None:
        item.title = menu.title
    if menu.desc is not None:
        item.description = menu.desc
    if menu.price is not None:
        item.price = menu.price
    if menu.image_url is not None:
        item.image_url = menu.image_url

    db.commit()
    return {"status": "updated"}



# ======================================================
# DELETE
# ======================================================
@router.delete("/{menu_id}", dependencies=[Depends(admin_guard)])
def delete_menu(menu_id: int, db: Session = Depends(get_db)):
    # 1. Fetch the item by ID
    item = db.query(models.MenuItem).filter(models.MenuItem.id == menu_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    # 2. Update the status to False (this hides it)
    item.is_active = False

    # 3. Commit the change to the database
    db.commit()

    return {"status": "deleted", "message": "Item is now inactive"}


@router.get("/admin/check")
def admin_check(dep=Depends(admin_guard)):
    return {"ok": True}
