from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from bson import ObjectId
from config import settings, users_collection, pwd_context, security


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
        if user.get("status") != "active":
            raise HTTPException(status_code=403, detail="User account is inactive. Please contact administrator.")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def check_permission(user: dict, module: str, action: str) -> bool:
    if user.get("is_admin"):
        return True
    permissions = user.get("permissions", {})
    module_perms = permissions.get(module, {})
    return module_perms.get(action, False) == True

def require_permission(module: str, action: str):
    async def check(current_user: dict = Depends(verify_token)):
        if not check_permission(current_user, module, action):
            raise HTTPException(status_code=403, detail=f"Permission denied: {module}.{action}")
        return current_user
    return check
