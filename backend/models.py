from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List


class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    first_name: str
    last_name: str
    mobile: str
    email: Optional[EmailStr] = None
    password: str
    status: str = "active"
    is_admin: bool = False
    permissions: dict = Field(default_factory=dict)

class UserUpdate(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    status: Optional[str] = None
    is_admin: Optional[bool] = None
    permissions: Optional[dict] = None

class JewelleryItem(BaseModel):
    name: str
    weight: float

class LandedEntry(BaseModel):
    date: str
    amount: float
    interest_rate: float
    remaining_principal: Optional[float] = None
    last_interest_calc_date: Optional[str] = None
    accumulated_interest: Optional[float] = 0.0

class ReceivedEntry(BaseModel):
    date: str
    amount: float
    principal_paid: Optional[float] = 0.0
    interest_paid: Optional[float] = 0.0

class AccountCreate(BaseModel):
    opening_date: str
    name: str
    village: str
    status: str = "continue"
    details: Optional[str] = ""
    jewellery_items: List[JewelleryItem] = Field(default_factory=list)
    landed_entries: List[LandedEntry] = Field(default_factory=list)
    received_entries: List[ReceivedEntry] = Field(default_factory=list)

class AccountUpdate(BaseModel):
    opening_date: Optional[str] = None
    name: Optional[str] = None
    village: Optional[str] = None
    status: Optional[str] = None
    details: Optional[str] = None
    jewellery_items: Optional[List[JewelleryItem]] = None
    landed_entries: Optional[List[LandedEntry]] = None
    received_entries: Optional[List[ReceivedEntry]] = None

class CloseAccountRequest(BaseModel):
    close_date: str
    remarks: Optional[str] = ""

class ReopenAccountRequest(BaseModel):
    reason: str
