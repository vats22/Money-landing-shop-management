from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Query, Header
from fastapi.responses import Response
from bson import ObjectId
from datetime import datetime, timezone
import uuid
import os
import requests
from auth import verify_token
from config import accounts_collection

router = APIRouter(prefix="/api", tags=["images"])

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "lendledger"
storage_key = None

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@router.post("/accounts/{account_id}/jewellery/{item_index}/images")
async def upload_jewellery_image(
    account_id: str,
    item_index: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_token)
):
    """Upload an image for a jewellery item (max 5 per item)"""
    account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    jewellery_items = account.get("jewellery_items", [])
    if item_index < 0 or item_index >= len(jewellery_items):
        raise HTTPException(status_code=400, detail="Invalid jewellery item index")

    existing_images = jewellery_items[item_index].get("images", [])
    if len(existing_images) >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images per jewellery item")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP images allowed")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/jewellery/{account_id}/{item_index}/{file_id}.{ext}"

    try:
        result = put_object(path, data, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    image_record = {
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": str(current_user["_id"])
    }

    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {"$push": {f"jewellery_items.{item_index}.images": image_record}}
    )

    return {"message": "Image uploaded successfully", "image": image_record}


@router.delete("/accounts/{account_id}/jewellery/{item_index}/images/{image_id}")
async def delete_jewellery_image(
    account_id: str,
    item_index: int,
    image_id: str,
    current_user: dict = Depends(verify_token)
):
    """Soft-delete a jewellery image"""
    result = await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {"$pull": {f"jewellery_items.{item_index}.images": {"id": image_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": "Image deleted successfully"}


@router.get("/files/{path:path}")
async def serve_file(
    path: str,
    authorization: str = Header(None),
    auth: str = Query(None)
):
    """Serve files from object storage with auth"""
    # Validate auth (either header or query param)
    from jose import JWTError, jwt as jose_jwt
    from config import settings
    
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        jose_jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")
