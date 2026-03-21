from fastapi import APIRouter, Depends
from auth import verify_token, verify_password, create_access_token, get_password_hash
from config import users_collection
from models import LoginRequest
from utils import serialize_doc

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(request: LoginRequest):
    user = await users_collection.find_one({
        "$or": [
            {"username": request.username},
            {"mobile": request.username}
        ]
    })
    if not user or not verify_password(request.password, user["password"]):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("status") != "active":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Account is inactive")
    token = create_access_token({"sub": str(user["_id"])})
    return {"token": token, "user": serialize_doc(user)}


@router.get("/me")
async def get_current_user(current_user: dict = Depends(verify_token)):
    return serialize_doc(current_user)
