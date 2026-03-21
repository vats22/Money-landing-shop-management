from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from config import settings, users_collection, counters_collection
from auth import get_password_hash

# Import routers
from routes.auth_routes import router as auth_router
from routes.users import router as users_router
from routes.dashboard import router as dashboard_router
from routes.accounts import router as accounts_router
from routes.reports import router as reports_router
from routes.export import router as export_router
from routes.images import router as images_router

# FastAPI App
app = FastAPI(title="LendLedger API", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(dashboard_router)
app.include_router(accounts_router)
app.include_router(reports_router)
app.include_router(export_router)
app.include_router(images_router)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.on_event("startup")
async def startup_event():
    # Create indexes
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("mobile", unique=True)
    from config import accounts_collection, ledger_collection
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
