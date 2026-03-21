from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId
from auth import verify_token, get_password_hash
from config import users_collection
from models import UserCreate, UserUpdate
from utils import serialize_doc

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def get_users(current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await users_collection.find().to_list(1000)
    return serialize_doc(users)


@router.post("", status_code=201)
async def create_user(user: UserCreate, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    existing = await users_collection.find_one({
        "$or": [{"username": user.username}, {"mobile": user.mobile}]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Username or mobile already exists")
    user_doc = {
        "username": user.username, "first_name": user.first_name, "last_name": user.last_name,
        "mobile": user.mobile, "email": user.email, "password": get_password_hash(user.password),
        "status": user.status, "is_admin": user.is_admin, "permissions": user.permissions,
        "created_at": datetime.now(timezone.utc), "created_by": str(current_user["_id"]),
        "updated_at": datetime.now(timezone.utc), "updated_by": str(current_user["_id"])
    }
    result = await users_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return serialize_doc(user_doc)


@router.put("/{user_id}")
async def update_user(user_id: str, user: UserUpdate, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    update_data = {k: v for k, v in user.model_dump().items() if v is not None}
    if "password" in update_data:
        update_data["password"] = get_password_hash(update_data["password"])
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = str(current_user["_id"])
    result = await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return serialize_doc(updated_user)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}


@router.put("/{user_id}/status")
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


@router.put("/{user_id}/permissions")
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
