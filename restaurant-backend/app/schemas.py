#COPAS
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel, HttpUrl
from datetime import date
from typing import Optional

# =====================================================
# EVENT
# =====================================================
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None

    start_date: date
    end_date: date

    detail_link: Optional[str] = None
    cover_image: Optional[str] = None

    is_featured: Optional[bool] = False

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    detail_link: Optional[str] = None
    cover_image: Optional[str] = None

    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]

    start_date: date
    end_date: date
    status: str

    detail_link: Optional[str]
    cover_image: Optional[str]

    is_active: bool
    is_featured: bool

    class Config:
        from_attributes = True

# =====================================================
# LOCATION
# =====================================================
class LocationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    phone_number: Optional[str] = Field(None, max_length=30)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    address: str = Field(..., min_length=2, max_length=255)
    hours: Optional[str] = Field(None, max_length=100)
    rating: Optional[float] = Field(None, ge=0, le=5)
    reviews: Optional[int] = Field(0, ge=0)
    image_url: Optional[str] = Field(None, max_length=255)
    maps_url: Optional[str] = Field(None, max_length=255)


class LocationCreate(BaseModel):
    name: str
    phone_number: Optional[str]
    lat: float
    lng: float
    address: str
    hours: Optional[str]
    image_url: Optional[str]
    maps_url: Optional[str]

class LocationOut(LocationBase):
    id: int
    rating: Optional[float]
    reviews: int

class LocationUpdate(BaseModel):
    name: Optional[str]
    phone_number: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    address: Optional[str]
    hours: Optional[str]
    image_url: Optional[str]
    maps_url: Optional[str]
    rating: Optional[float]
    reviews: Optional[int]

# =====================================================
# MENU
# =====================================================
class MenuBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    price: int = Field(..., gt=0)
    image_url: Optional[str] = Field(None, max_length=255)
    is_active: bool = True


class MenuCreate(MenuBase):
    category_id: int = Field(..., gt=0)

class MenuUpdate(BaseModel):
    title: Optional[str]
    desc: Optional[str]
    price: Optional[int]
    image_url: Optional[str]
    category: Optional[str]

class MenuOut(MenuBase):
    id: int
    category_id: int

    class Config:
        from_attributes = True


class MenuCategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# =====================================================
# ORDER
# =====================================================
class OrderItemOut(BaseModel):
    id: int
    menu_item_id: int
    quantity: int = Field(..., gt=0)

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    visitor_token: UUID
    status: str
    expires_at: datetime
    created_at: datetime
    items: List[OrderItemOut] = Field(default_factory=list)

    class Config:
        from_attributes = True

# schemas/order.py
class OrderItemSummary(BaseModel):
    title: str
    quantity: int

    class Config:
        from_attributes = True


# =====================================================
# RESERVATION
# =====================================================
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time


class ReservationCreate(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    pax: int = Field(..., ge=1, le=20)

    reservation_date: date
    reservation_time: time

    location_id: int
    order_id: Optional[int] = None


from datetime import datetime, date, time


class ReservationOut(BaseModel):
    id: int
    order_id: Optional[int]

    location_id: int
    customer_name: str
    phone: Optional[str]
    pax: int

    reservation_date: date
    reservation_time: time

    queue_number: int
    status: str
    created_at: datetime

    order_items: list[OrderItemSummary] = Field(default_factory=list)

    @classmethod
    def model_validate(cls, obj, **kwargs):
        data = super().model_validate(obj, **kwargs)
        data.order_items = getattr(obj, "order_items", [])
        return data

    class Config:
        from_attributes = True
