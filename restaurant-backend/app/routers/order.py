from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from uuid import UUID

from app.database import get_db
from app.models import Order, OrderItem, MenuItem

router = APIRouter(prefix="/orders", tags=["Orders"])


# =====================================================
# CREATE / GET DRAFT ORDER
# =====================================================
from uuid import uuid4

@router.post("/draft", status_code=status.HTTP_201_CREATED)
def get_or_create_draft(
    visitor_token: UUID | None = Header(None, alias="X-Visitor-Token"),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    # 1️⃣ Kalau token dikirim → coba pakai draft lama
    if visitor_token:
        order = (
            db.query(Order)
            .filter(
                Order.visitor_token == visitor_token,
                Order.status == "draft",
                Order.expires_at > now
            )
            .first()
        )

        if order:
            return {
                "order_id": order.id,
                "visitor_token": order.visitor_token,
                "expires_at": order.expires_at
            }

    # 2️⃣ Kalau tidak ada / expired → buat baru
    new_token = uuid4()

    order = Order(
        visitor_token=new_token,
        status="draft",
        expires_at=now + timedelta(hours=1)
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "order_id": order.id,
        "visitor_token": new_token,
        "expires_at": order.expires_at
    }


# =====================================================
# ADD ITEM TO DRAFT
# =====================================================
@router.post("/{order_id}/add/{menu_item_id}")
def add_to_draft(
    order_id: int,
    menu_item_id: int,
    visitor_token: UUID = Header(..., alias="X-Visitor-Token"),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    with db.begin():
        order = (
            db.query(Order)
            .filter(
                Order.id == order_id,
                Order.visitor_token == visitor_token,
                Order.status == "draft",
                Order.expires_at > now
            )
            .with_for_update()
            .first()
        )

        if not order:
            raise HTTPException(404, "Draft order not found or expired")

        menu_item = db.query(MenuItem).filter(
            MenuItem.id == menu_item_id,
            MenuItem.is_active.is_(True)
        ).first()

        if not menu_item:
            raise HTTPException(404, "Menu item not found")

        item = (
            db.query(OrderItem)
            .filter_by(order_id=order.id, menu_item_id=menu_item_id)
            .with_for_update()
            .first()
        )

        if item:
            item.quantity += 1
        else:
            db.add(OrderItem(
                order_id=order.id,
                menu_item_id=menu_item_id,
                quantity=1
            ))

    return {"status": "added"}


# =====================================================
# GET ORDER (SECURED)
# =====================================================
@router.get("/{order_id}")
def get_order(
    order_id: int,
    visitor_token: UUID = Header(..., alias="X-Visitor-Token"),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.visitor_token == visitor_token,
        Order.expires_at > now
    ).first()

    if not order:
        raise HTTPException(404, "Order not found")

    if order.status != "draft":
        raise HTTPException(403, "Order already confirmed")

    return {
        "id": order.id,
        "status": order.status,
        "expires_at": order.expires_at,
        "items": [
            {
                "menu_item_id": item.menu_item_id,
                "title": item.menu_item.title,
                "price": item.menu_item.price,
                "quantity": item.quantity,
                "subtotal": item.menu_item.price * item.quantity
            }
            for item in order.items
        ]
    }


@router.post("/{order_id}/confirm")
def confirm_order(
    order_id: int,
    visitor_token: UUID = Header(..., alias="X-Visitor-Token"),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.visitor_token == visitor_token,
        Order.status == "draft",
        Order.expires_at > now
    ).first()

    if not order:
        raise HTTPException(404, "Draft order not found or expired")

    if not order.items:
        raise HTTPException(400, "Order is empty")

    order.status = "confirmed"
    db.commit()

    return {"status": "confirmed"}


@router.post("/{order_id}/inc/{menu_item_id}")
def increase_qty(
    order_id: int,
    menu_item_id: int,
    visitor_token: UUID = Header(..., alias="X-Visitor-Token"),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    with db.begin():
        item = (
            db.query(OrderItem)
            .join(Order)
            .filter(
                Order.id == order_id,
                Order.visitor_token == visitor_token,
                Order.status == "draft",
                Order.expires_at > now,
                OrderItem.menu_item_id == menu_item_id
            )
            .with_for_update()
            .first()
        )

        if not item:
            raise HTTPException(404, "Item not found or order locked")

        item.quantity += 1

    return {"status": "ok"}


@router.post("/{order_id}/dec/{menu_item_id}")
def decrease_qty(
    order_id: int,
    menu_item_id: int,
    visitor_token: UUID = Header(..., alias="X-Visitor-Token"),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    with db.begin():
        item = (
            db.query(OrderItem)
            .join(Order)
            .filter(
                Order.id == order_id,
                Order.visitor_token == visitor_token,
                Order.status == "draft",
                Order.expires_at > now,
                OrderItem.menu_item_id == menu_item_id
            )
            .with_for_update()
            .first()
        )

        if not item:
            raise HTTPException(404, "Item not found or order locked")

        if item.quantity <= 1:
            db.delete(item)
        else:
            item.quantity -= 1

    return {"status": "ok"}
