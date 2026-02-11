#COPAS
import uuid
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
    Boolean,
    CheckConstraint,
    UniqueConstraint,
    Index,
    Date
)
from datetime import datetime, timedelta
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from .database import Base

# =====================================================
# MENU CATEGORY
# =====================================================
class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)

    items = relationship(
        "MenuItem",
        back_populates="category",
        cascade="save-update, merge"
    )


# =====================================================
# MENU ITEM
# =====================================================
class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True)
    category_id = Column(
        Integer,
        ForeignKey("menu_categories.id", ondelete="RESTRICT"),
        nullable=False
    )

    title = Column(String, nullable=False)
    description = Column(String)
    price = Column(Integer, CheckConstraint("price > 0"), nullable=False)
    image_url = Column(String)
    is_active = Column(Boolean, nullable=False, default=True)

    category = relationship("MenuCategory", back_populates="items")

    __table_args__ = (
        Index("idx_menu_items_category", "category_id"),
    )


# =====================================================
# ORDER (VISITOR SESSION)
# =====================================================
class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)

    visitor_token = Column(
        UUID(as_uuid=True),
        default=uuid.uuid4,
        nullable=False,
        unique=True,
        index=True
    )


    order_name = Column(String, default="Draft Order")

    status = Column(
        String,
        CheckConstraint("status IN ('draft','confirmed','cancelled')"),
        nullable=False,
        default="draft",
        index=True
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.utcnow() + timedelta(hours=1)
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    reservation = relationship(
        "Reservation",
        back_populates="order",
        uselist=False
    )

    __table_args__ = (
        Index("idx_orders_status", "status"),
        Index("idx_orders_expires", "expires_at"),
    )


# =====================================================
# ORDER ITEM
# =====================================================
class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)

    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False
    )

    menu_item_id = Column(
        Integer,
        ForeignKey("menu_items.id", ondelete="RESTRICT"),
        nullable=False
    )

    quantity = Column(
        Integer,
        CheckConstraint("quantity > 0"),
        nullable=False,
        default=1
    )

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem")

    __table_args__ = (
        UniqueConstraint("order_id", "menu_item_id"),
        Index("idx_order_items_order", "order_id"),
    )


# =====================================================
# DAILY QUEUE COUNTER (ANTI RACE CONDITION)
# =====================================================
class DailyQueueCounter(Base):
    __tablename__ = "daily_queue_counters"

    queue_date = Column(Date, primary_key=True)
    last_number = Column(Integer, nullable=False, default=0)


# =====================================================
# RESERVATION (QUEUE SYSTEM)
# =====================================================
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Time,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True,
        unique=True
    )

    customer_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)

    pax = Column(Integer, nullable=False, default=1)

    reservation_date = Column(Date, nullable=False, index=True)
    reservation_time = Column(Time, nullable=False)

    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False
    )

    queue_number = Column(Integer, nullable=False)

    status = Column(
        String,
        nullable=False,
        default="pending"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    order = relationship("Order", back_populates="reservation")
    location = relationship("Location")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','confirmed','cancelled')",
            name="chk_reservation_status"
        ),
        UniqueConstraint(
            "reservation_date",
            "queue_number",
            name="uq_reservations_daily_queue"
        ),
        Index(
            "idx_reservations_admin_view",
            "reservation_date",
            "location_id",
            "status"
        ),
    )

    @property
    def order_items(self):
        if not self.order:
            return []
        return [
            {
                "title": item.menu_item.title,
                "quantity": item.quantity
            }
            for item in self.order.items
        ]




# =====================================================
# LOCATION
# =====================================================
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    phone_number = Column(String)

    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String, nullable=False)

    hours = Column(String)
    rating = Column(
        Float,
        CheckConstraint("rating >= 0 AND rating <= 5")
    )
    reviews = Column(Integer, default=0)

    image_url = Column(String)
    maps_url = Column(String)
    is_active = Column(Boolean, default=True)


# =====================================================
# EVENT
# =====================================================
from sqlalchemy import Column, Integer, String, Text, Date, Boolean, TIMESTAMP
from sqlalchemy.sql import func
from .database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(150), nullable=False)
    description = Column(Text)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    status = Column(String(20), nullable=False, default="upcoming")

    detail_link = Column(Text, nullable=True)
    cover_image = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
