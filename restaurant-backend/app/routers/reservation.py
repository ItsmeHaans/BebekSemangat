from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from datetime import datetime, timezone, date
from typing import Optional, List

from app.database import get_db
from app.deps.admin import admin_guard
from app.models import (
    Reservation,
    Order,
    DailyQueueCounter
)
from app.schemas import ReservationCreate, ReservationOut

router = APIRouter(prefix="/reservations", tags=["Reservations"])


@router.post(
    "/",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_reservation(
    data: ReservationCreate,
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    # Optional draft order validation
    order = None
    if data.order_id:
        order = (
            db.query(Order)
            .filter(
                Order.id == data.order_id,
                Order.status == "draft",
                Order.expires_at > now
            )
            .with_for_update()
            .first()
        )

        if not order:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Active draft order not found or expired"
            )

        if order.reservation:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Order already has a reservation"
            )

    try:
        # 🔒 Lock daily counter row
        counter = (
            db.query(DailyQueueCounter)
            .filter(DailyQueueCounter.queue_date == data.reservation_date)
            .with_for_update()
            .first()
        )

        if not counter:
            counter = DailyQueueCounter(
                queue_date=data.reservation_date,
                last_number=0
            )
            db.add(counter)
            db.flush()  # ensure row exists before increment

        counter.last_number += 1
        queue_number = counter.last_number

        reservation = Reservation(
            order_id=data.order_id,
            location_id=data.location_id,
            customer_name=data.customer_name,
            phone=data.phone,
            pax=data.pax,
            reservation_date=data.reservation_date,
            reservation_time=data.reservation_time,
            queue_number=queue_number,
            status="pending"
        )

        db.add(reservation)

        if order:
            order.status = "confirmed"

        db.commit()
        db.refresh(reservation)
        return reservation

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Failed to create reservation, please retry"
        )

from sqlalchemy.orm import joinedload
from app.models import OrderItem

@router.get(
    "/",
    response_model=List[ReservationOut],
    dependencies=[Depends(admin_guard)]
)
def list_reservations(
    reservation_date: Optional[date] = None,
    location_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = (
        db.query(Reservation)
        .options(
            joinedload(Reservation.order)
            .joinedload(Order.items)
            .joinedload(OrderItem.menu_item)
        )
    )

    if reservation_date:
        query = query.filter(Reservation.reservation_date == reservation_date)

    if location_id:
        query = query.filter(Reservation.location_id == location_id)

    if status:
        query = query.filter(Reservation.status == status)

    return (
        query
        .order_by(
            Reservation.reservation_date.desc(),
            Reservation.queue_number.asc()
        )
        .all()
    )


@router.patch(
    "/{reservation_id}/status",
    response_model=ReservationOut,
    dependencies=[Depends(admin_guard)]
)
def update_reservation_status(
    reservation_id: int,
    status: str,
    db: Session = Depends(get_db)
):
    if status not in {"pending", "confirmed", "cancelled"}:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Invalid status"
        )

    reservation = (
        db.query(Reservation)
        .filter(Reservation.id == reservation_id)
        .first()
    )

    if not reservation:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Reservation not found"
        )

    reservation.status = status
    db.commit()
    db.refresh(reservation)

    return reservation

@router.get("/admin/check")
def admin_check(dep=Depends(admin_guard)):
    return {"ok": True}