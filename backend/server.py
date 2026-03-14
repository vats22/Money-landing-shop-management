from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from pydantic_settings import BaseSettings
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from dotenv import load_dotenv
import math

load_dotenv()

# Settings
class Settings(BaseSettings):
    mongo_url: str = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name: str = os.environ.get("DB_NAME", "lendledger")
    jwt_secret: str = os.environ.get("JWT_SECRET", "lendledger_jwt_secret_key_2024_secure")
    jwt_algorithm: str = os.environ.get("JWT_ALGORITHM", "HS256")
    jwt_expiration_hours: int = int(os.environ.get("JWT_EXPIRATION_HOURS", "24"))

settings = Settings()

# FastAPI App
app = FastAPI(title="LendLedger API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection
client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.db_name]

# Collections
users_collection = db["users"]
accounts_collection = db["accounts"]
ledger_collection = db["ledger"]
permissions_collection = db["permissions"]
counters_collection = db["counters"]

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Security
security = HTTPBearer()

# Helper Functions
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiration_hours)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    """Convert MongoDB document to JSON serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == "_id":
                result["id"] = str(value)
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, list):
                result[key] = serialize_doc(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc

async def get_next_account_number():
    """Get next auto-increment account number"""
    counter = await counters_collection.find_one_and_update(
        {"_id": "account_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return counter["seq"]

# Pydantic Models
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

# Interest Calculation Logic
def calculate_interest_for_entry(landed_entry: dict, calc_date: datetime) -> float:
    """Calculate interest for a single landed entry up to calc_date"""
    try:
        date_str = landed_entry.get("last_interest_calc_date") or landed_entry.get("date")
        if not date_str:
            return 0.0
        entry_date = datetime.fromisoformat(date_str)
        if isinstance(entry_date, str):
            entry_date = datetime.fromisoformat(entry_date)
        
        # Ensure both dates have the same timezone awareness
        if entry_date.tzinfo is None and calc_date.tzinfo is not None:
            entry_date = entry_date.replace(tzinfo=timezone.utc)
        elif entry_date.tzinfo is not None and calc_date.tzinfo is None:
            calc_date = calc_date.replace(tzinfo=timezone.utc)
        
        principal = landed_entry.get("remaining_principal") or landed_entry.get("amount", 0) or 0
        interest_rate = landed_entry.get("interest_rate", 2) or 2
        rate = float(interest_rate) / 100  # Convert percentage to decimal
        
        # Calculate months between dates
        days = (calc_date - entry_date).days
        months = days / 30.0  # Approximate months
        
        # Monthly interest calculation
        interest = float(principal) * rate * months
        accumulated = float(landed_entry.get("accumulated_interest", 0.0) or 0.0)
        
        return round(interest + accumulated, 2)
    except Exception as e:
        print(f"Error calculating interest: {e}")
        return 0.0

def calculate_account_totals(account: dict) -> dict:
    """Calculate all account totals including interest"""
    now = datetime.now(timezone.utc)
    
    total_landed = sum(entry.get("amount", 0) or 0 for entry in account.get("landed_entries", []))
    total_received = sum(entry.get("amount", 0) or 0 for entry in account.get("received_entries", []))
    received_principal = sum(entry.get("principal_paid", 0) or 0 for entry in account.get("received_entries", []))
    received_interest = sum(entry.get("interest_paid", 0) or 0 for entry in account.get("received_entries", []))
    
    # Calculate total pending principal
    total_pending_principal = total_landed - received_principal
    
    # Calculate current total interest
    total_interest = 0.0
    for entry in account.get("landed_entries", []):
        remaining_principal = entry.get("remaining_principal") or entry.get("amount", 0) or 0
        if remaining_principal and remaining_principal > 0:
            total_interest += calculate_interest_for_entry(entry, now)
    
    # Pending interest = total calculated interest - interest already paid
    total_pending_interest = max(0, total_interest - received_interest)
    
    # Total jewellery weight
    total_jewellery_weight = sum(item.get("weight", 0) or 0 for item in account.get("jewellery_items", []))
    
    return {
        "total_landed_amount": round(total_landed, 2),
        "total_received_amount": round(total_received, 2),
        "received_principal": round(received_principal, 2),
        "received_interest": round(received_interest, 2),
        "total_pending_amount": round(total_pending_principal, 2),
        "total_interest_amount": round(total_interest, 2),
        "total_pending_interest": round(total_pending_interest, 2),
        "total_jewellery_weight": round(total_jewellery_weight, 2)
    }

def process_payment(landed_entries: List[dict], payment_amount: float, payment_date: datetime) -> tuple:
    """Process payment and distribute between interest and principal"""
    remaining_payment = payment_amount
    total_interest_paid = 0.0
    total_principal_paid = 0.0
    
    # First, calculate total interest due
    total_interest_due = 0.0
    for entry in landed_entries:
        if entry.get("remaining_principal", entry["amount"]) > 0:
            total_interest_due += calculate_interest_for_entry(entry, payment_date)
    
    # Case 1: Payment >= Interest Due
    if remaining_payment >= total_interest_due:
        total_interest_paid = total_interest_due
        remaining_payment -= total_interest_due
        
        # Reset accumulated interest and update last calc date for all entries
        for entry in landed_entries:
            entry["accumulated_interest"] = 0.0
            entry["last_interest_calc_date"] = payment_date.isoformat()
        
        # Distribute remaining to principal (FIFO - oldest first)
        for entry in landed_entries:
            if remaining_payment <= 0:
                break
            remaining_principal = entry.get("remaining_principal", entry["amount"])
            if remaining_principal > 0:
                principal_payment = min(remaining_payment, remaining_principal)
                entry["remaining_principal"] = remaining_principal - principal_payment
                total_principal_paid += principal_payment
                remaining_payment -= principal_payment
    
    # Case 2: Payment < Interest Due
    else:
        total_interest_paid = remaining_payment
        
        # Distribute partial interest payment and carry forward remaining
        remaining_interest_payment = remaining_payment
        for entry in landed_entries:
            if remaining_interest_payment <= 0:
                break
            entry_interest = calculate_interest_for_entry(entry, payment_date)
            if entry_interest > 0:
                interest_paid_for_entry = min(remaining_interest_payment, entry_interest)
                entry["accumulated_interest"] = entry_interest - interest_paid_for_entry
                entry["last_interest_calc_date"] = payment_date.isoformat()
                remaining_interest_payment -= interest_paid_for_entry
    
    return landed_entries, round(total_principal_paid, 2), round(total_interest_paid, 2)

async def create_ledger_entry(account_id: str, transaction_type: str, amount: float, 
                             principal_amount: float, interest_amount: float, 
                             balance_amount: float, created_by: str, transaction_date: str = None):
    """Create a ledger entry"""
    # Use provided date or current date
    if transaction_date:
        try:
            txn_date = datetime.fromisoformat(transaction_date)
            if txn_date.tzinfo is None:
                txn_date = txn_date.replace(tzinfo=timezone.utc)
        except:
            txn_date = datetime.now(timezone.utc)
    else:
        txn_date = datetime.now(timezone.utc)
    
    ledger_entry = {
        "account_id": account_id,
        "transaction_date": txn_date,
        "transaction_type": transaction_type,
        "amount": amount,
        "principal_amount": principal_amount,
        "interest_amount": interest_amount,
        "balance_amount": balance_amount,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc)
    }
    await ledger_collection.insert_one(ledger_entry)

# API Routes

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Auth Routes
@app.post("/api/auth/login")
async def login(request: LoginRequest):
    # Find user by username or mobile
    user = await users_collection.find_one({
        "$or": [
            {"username": request.username},
            {"mobile": request.username}
        ]
    })
    
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    token = create_access_token({"sub": str(user["_id"])})
    
    return {
        "token": token,
        "user": serialize_doc(user)
    }

@app.get("/api/auth/me")
async def get_current_user(current_user: dict = Depends(verify_token)):
    return serialize_doc(current_user)

# User Management Routes
@app.get("/api/users")
async def get_users(current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await users_collection.find().to_list(1000)
    return serialize_doc(users)

@app.post("/api/users", status_code=201)
async def create_user(user: UserCreate, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if username or mobile exists
    existing = await users_collection.find_one({
        "$or": [
            {"username": user.username},
            {"mobile": user.mobile}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Username or mobile already exists")
    
    user_doc = {
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "mobile": user.mobile,
        "email": user.email,
        "password": get_password_hash(user.password),
        "status": user.status,
        "is_admin": user.is_admin,
        "permissions": user.permissions,
        "created_at": datetime.now(timezone.utc),
        "created_by": str(current_user["_id"]),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": str(current_user["_id"])
    }
    
    result = await users_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    
    return serialize_doc(user_doc)

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user: UserUpdate, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in user.model_dump().items() if v is not None}
    if "password" in update_data:
        update_data["password"] = get_password_hash(update_data["password"])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = str(current_user["_id"])
    
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return serialize_doc(updated_user)

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@app.put("/api/users/{user_id}/status")
async def toggle_user_status(user_id: str, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = "inactive" if user.get("status") == "active" else "active"
    
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": f"User status changed to {new_status}", "status": new_status}

@app.put("/api/users/{user_id}/permissions")
async def update_user_permissions(user_id: str, permissions: dict, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"permissions": permissions, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Permissions updated successfully"}

# Dashboard Routes
@app.get("/api/dashboard/summary")
async def get_dashboard_summary(current_user: dict = Depends(verify_token)):
    accounts = await accounts_collection.find().to_list(10000)
    
    total_landed = 0.0
    total_received = 0.0
    total_pending = 0.0
    total_pending_interest = 0.0
    
    for account in accounts:
        totals = calculate_account_totals(account)
        total_landed += totals["total_landed_amount"]
        total_received += totals["total_received_amount"]
        total_pending += totals["total_pending_amount"]
        total_pending_interest += totals["total_pending_interest"]
    
    return {
        "total_landed_amount": round(total_landed, 2),
        "total_received_amount": round(total_received, 2),
        "total_pending_amount": round(total_pending, 2),
        "total_pending_interest": round(total_pending_interest, 2)
    }

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(verify_token)):
    total_accounts = await accounts_collection.count_documents({})
    active_accounts = await accounts_collection.count_documents({"status": "continue"})
    closed_accounts = await accounts_collection.count_documents({"status": "closed"})
    
    return {
        "total_accounts": total_accounts,
        "active_accounts": active_accounts,
        "closed_accounts": closed_accounts
    }

# Accounts Routes
@app.get("/api/accounts")
async def get_accounts(
    current_user: dict = Depends(verify_token),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    village: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = "account_number",
    sort_order: str = "desc"
):
    query = {}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"account_number": {"$regex": search, "$options": "i"}}
        ]
    
    if village:
        query["village"] = {"$regex": village, "$options": "i"}
    
    if status:
        query["status"] = status
    
    if start_date and end_date:
        query["opening_date"] = {"$gte": start_date, "$lte": end_date}
    
    # Sorting
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Pagination
    skip = (page - 1) * limit
    
    total = await accounts_collection.count_documents(query)
    accounts = await accounts_collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit).to_list(limit)
    
    # Calculate totals for each account
    enriched_accounts = []
    for account in accounts:
        totals = calculate_account_totals(account)
        account_data = serialize_doc(account)
        account_data.update(totals)
        enriched_accounts.append(account_data)
    
    return {
        "accounts": enriched_accounts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 1
    }

@app.get("/api/accounts/{account_id}")
async def get_account(account_id: str, current_user: dict = Depends(verify_token)):
    account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check if account is closed and user doesn't have permission
    if account.get("status") == "closed":
        if not current_user.get("is_admin") and not current_user.get("permissions", {}).get("unlock_closed_account"):
            # User can view but not modify
            pass
    
    totals = calculate_account_totals(account)
    account_data = serialize_doc(account)
    account_data.update(totals)
    
    return account_data

@app.post("/api/accounts", status_code=201)
async def create_account(account: AccountCreate, current_user: dict = Depends(verify_token)):
    # Get next account number
    account_number = await get_next_account_number()
    
    # Initialize remaining principal for landed entries
    landed_entries = []
    for entry in account.landed_entries:
        entry_dict = entry.model_dump()
        entry_dict["remaining_principal"] = entry.amount
        entry_dict["last_interest_calc_date"] = entry.date
        entry_dict["accumulated_interest"] = 0.0
        landed_entries.append(entry_dict)
    
    # Process received entries
    received_entries = []
    if account.received_entries:
        for recv_entry in account.received_entries:
            payment_date = datetime.fromisoformat(recv_entry.date)
            landed_entries, principal_paid, interest_paid = process_payment(
                landed_entries, recv_entry.amount, payment_date
            )
            recv_dict = recv_entry.model_dump()
            recv_dict["principal_paid"] = principal_paid
            recv_dict["interest_paid"] = interest_paid
            received_entries.append(recv_dict)
    
    account_doc = {
        "account_number": f"ACC{account_number:06d}",
        "opening_date": account.opening_date,
        "name": account.name,
        "village": account.village,
        "status": account.status,
        "details": account.details,
        "jewellery_items": [item.model_dump() for item in account.jewellery_items],
        "landed_entries": landed_entries,
        "received_entries": received_entries,
        "created_at": datetime.now(timezone.utc),
        "created_by": str(current_user["_id"]),
        "created_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username'),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": str(current_user["_id"]),
        "updated_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username')
    }
    
    result = await accounts_collection.insert_one(account_doc)
    account_doc["_id"] = result.inserted_id
    
    # Create ledger entries
    for entry in landed_entries:
        totals = calculate_account_totals(account_doc)
        await create_ledger_entry(
            str(result.inserted_id),
            "LANDED",
            entry["amount"],
            entry["amount"],
            0,
            totals["total_pending_amount"],
            str(current_user["_id"]),
            entry["date"]  # Use the actual landed date
        )
    
    for entry in received_entries:
        totals = calculate_account_totals(account_doc)
        await create_ledger_entry(
            str(result.inserted_id),
            "PAYMENT",
            entry["amount"],
            entry["principal_paid"],
            entry["interest_paid"],
            totals["total_pending_amount"],
            str(current_user["_id"]),
            entry["date"]  # Use the actual received date
        )
    
    totals = calculate_account_totals(account_doc)
    response = serialize_doc(account_doc)
    response.update(totals)
    
    return response

@app.put("/api/accounts/{account_id}")
async def update_account(account_id: str, account: AccountUpdate, current_user: dict = Depends(verify_token)):
    existing = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check if account is closed
    if existing.get("status") == "closed":
        if not current_user.get("is_admin") and not current_user.get("permissions", {}).get("unlock_closed_account"):
            raise HTTPException(status_code=403, detail="Cannot modify closed account")
    
    update_data = {k: v for k, v in account.model_dump().items() if v is not None}
    
    # Process jewellery items if provided
    if "jewellery_items" in update_data:
        jewellery_items = []
        for item in update_data["jewellery_items"]:
            if isinstance(item, dict) and item.get("name") and item.get("weight"):
                jewellery_items.append({
                    "name": item["name"],
                    "weight": float(item["weight"])
                })
        update_data["jewellery_items"] = jewellery_items
    
    # Process landed entries if provided - initialize for payment processing
    if "landed_entries" in update_data:
        landed_entries = []
        for entry in update_data["landed_entries"]:
            if isinstance(entry, dict) and entry.get("date") and entry.get("amount"):
                processed_entry = {
                    "date": entry["date"],
                    "amount": float(entry["amount"]),
                    "interest_rate": float(entry.get("interest_rate", 2)),
                    "remaining_principal": float(entry["amount"]),  # Reset for recalculation
                    "last_interest_calc_date": entry["date"],  # Reset for recalculation
                    "accumulated_interest": 0.0  # Reset for recalculation
                }
                landed_entries.append(processed_entry)
        update_data["landed_entries"] = landed_entries
    else:
        # Use existing landed entries
        landed_entries = existing.get("landed_entries", [])
        # Reset them for recalculation
        for entry in landed_entries:
            entry["remaining_principal"] = float(entry["amount"])
            entry["last_interest_calc_date"] = entry["date"]
            entry["accumulated_interest"] = 0.0
        update_data["landed_entries"] = landed_entries
    
    # Process received entries - recalculate payment distribution
    if "received_entries" in update_data:
        landed_entries = update_data["landed_entries"]
        received_entries = []
        new_ledger_entries = []
        
        # Sort received entries by date
        raw_received = sorted(
            [e for e in update_data["received_entries"] if isinstance(e, dict) and e.get("date") and e.get("amount")],
            key=lambda x: x["date"]
        )
        
        for recv_entry in raw_received:
            payment_date = datetime.fromisoformat(recv_entry["date"])
            payment_amount = float(recv_entry["amount"])
            
            # Process payment through all landed entries
            landed_entries, principal_paid, interest_paid = process_payment(
                landed_entries, payment_amount, payment_date
            )
            
            processed_entry = {
                "date": recv_entry["date"],
                "amount": payment_amount,
                "principal_paid": principal_paid,
                "interest_paid": interest_paid
            }
            received_entries.append(processed_entry)
            
            # Track new ledger entries needed
            new_ledger_entries.append({
                "date": recv_entry["date"],
                "amount": payment_amount,
                "principal_paid": principal_paid,
                "interest_paid": interest_paid
            })
        
        update_data["received_entries"] = received_entries
        update_data["landed_entries"] = landed_entries
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = str(current_user["_id"])
    update_data["updated_by_name"] = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username')
    
    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": update_data}
    )
    
    # Regenerate ledger entries for this account
    await ledger_collection.delete_many({"account_id": account_id})
    
    updated_account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    
    # Create ledger entries for landed entries
    running_balance = 0.0
    for entry in updated_account.get("landed_entries", []):
        running_balance += float(entry["amount"])
        await create_ledger_entry(
            account_id,
            "LANDED",
            entry["amount"],
            entry["amount"],
            0,
            running_balance,
            str(current_user["_id"]),
            entry["date"]
        )
    
    # Create ledger entries for received entries
    for entry in updated_account.get("received_entries", []):
        running_balance -= float(entry.get("principal_paid", 0))
        await create_ledger_entry(
            account_id,
            "PAYMENT",
            entry["amount"],
            entry.get("principal_paid", 0),
            entry.get("interest_paid", 0),
            running_balance,
            str(current_user["_id"]),
            entry["date"]
        )
    
    totals = calculate_account_totals(updated_account)
    response = serialize_doc(updated_account)
    response.update(totals)
    
    return response

@app.delete("/api/accounts/{account_id}")
async def delete_account(account_id: str, current_user: dict = Depends(verify_token)):
    existing = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check permissions
    if not current_user.get("is_admin"):
        perms = current_user.get("permissions", {})
        if not perms.get("accounts", {}).get("delete"):
            raise HTTPException(status_code=403, detail="Permission denied")
    
    # Delete account and related ledger entries
    await accounts_collection.delete_one({"_id": ObjectId(account_id)})
    await ledger_collection.delete_many({"account_id": account_id})
    
    return {"message": "Account deleted successfully"}

# Landed Entry Routes
@app.post("/api/accounts/{account_id}/landed")
async def add_landed_entry(account_id: str, entry: LandedEntry, current_user: dict = Depends(verify_token)):
    account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    entry_dict = entry.model_dump()
    entry_dict["remaining_principal"] = entry.amount
    entry_dict["last_interest_calc_date"] = entry.date
    entry_dict["accumulated_interest"] = 0.0
    
    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {
            "$push": {"landed_entries": entry_dict},
            "$set": {
                "updated_at": datetime.now(timezone.utc),
                "updated_by": str(current_user["_id"])
            }
        }
    )
    
    # Create ledger entry
    updated_account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    totals = calculate_account_totals(updated_account)
    await create_ledger_entry(
        account_id,
        "LANDED",
        entry.amount,
        entry.amount,
        0,
        totals["total_pending_amount"],
        str(current_user["_id"]),
        entry.date  # Pass the actual landed date
    )
    
    return {"message": "Landed entry added successfully"}

# Received Entry Routes
@app.post("/api/accounts/{account_id}/received")
async def add_received_entry(account_id: str, entry: ReceivedEntry, current_user: dict = Depends(verify_token)):
    account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    payment_date = datetime.fromisoformat(entry.date)
    landed_entries = account.get("landed_entries", [])
    
    # Process payment
    landed_entries, principal_paid, interest_paid = process_payment(
        landed_entries, entry.amount, payment_date
    )
    
    recv_dict = entry.model_dump()
    recv_dict["principal_paid"] = principal_paid
    recv_dict["interest_paid"] = interest_paid
    
    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {
            "$set": {
                "landed_entries": landed_entries,
                "updated_at": datetime.now(timezone.utc),
                "updated_by": str(current_user["_id"])
            },
            "$push": {"received_entries": recv_dict}
        }
    )
    
    # Create ledger entry
    updated_account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    totals = calculate_account_totals(updated_account)
    await create_ledger_entry(
        account_id,
        "PAYMENT",
        entry.amount,
        principal_paid,
        interest_paid,
        totals["total_pending_amount"],
        str(current_user["_id"]),
        entry.date  # Pass the actual payment date
    )
    
    return {
        "message": "Payment received successfully",
        "principal_paid": principal_paid,
        "interest_paid": interest_paid
    }

# Ledger Routes
@app.get("/api/ledger/{account_id}")
async def get_account_ledger(account_id: str, current_user: dict = Depends(verify_token)):
    ledger_entries = await ledger_collection.find({"account_id": account_id}).sort("transaction_date", 1).to_list(1000)
    return serialize_doc(ledger_entries)

# Villages list for filter
@app.get("/api/villages")
async def get_villages(current_user: dict = Depends(verify_token)):
    villages = await accounts_collection.distinct("village")
    return villages

# Initialize admin user on startup
@app.on_event("startup")
async def startup_event():
    # Create indexes
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("mobile", unique=True)
    await accounts_collection.create_index("account_number", unique=True)
    await accounts_collection.create_index("name")
    await accounts_collection.create_index("village")
    await ledger_collection.create_index("account_id")
    
    # Create default admin if not exists
    admin = await users_collection.find_one({"username": "admin"})
    if not admin:
        admin_doc = {
            "username": "admin",
            "first_name": "Master",
            "last_name": "Admin",
            "mobile": "9999999999",
            "email": "admin@lendledger.com",
            "password": get_password_hash("admin123"),
            "status": "active",
            "is_admin": True,
            "permissions": {},
            "created_at": datetime.now(timezone.utc),
            "created_by": "system",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        }
        await users_collection.insert_one(admin_doc)
        print("Default admin user created: admin / admin123")
    
    # Initialize account counter if not exists
    counter = await counters_collection.find_one({"_id": "account_number"})
    if not counter:
        await counters_collection.insert_one({"_id": "account_number", "seq": 0})
