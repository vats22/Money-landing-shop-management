from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from fastapi.security import HTTPBearer
import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

class Settings(BaseSettings):
    mongo_url: str = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name: str = os.environ.get("DB_NAME", "lendledger")
    jwt_secret: str = os.environ.get("JWT_SECRET", "lendledger_jwt_secret_key_2024_secure")
    jwt_algorithm: str = os.environ.get("JWT_ALGORITHM", "HS256")
    jwt_expiration_hours: int = int(os.environ.get("JWT_EXPIRATION_HOURS", "24"))

settings = Settings()

# MongoDB Connection
client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.db_name]

# Collections
users_collection = db["users"]
accounts_collection = db["accounts"]
ledger_collection = db["ledger"]
counters_collection = db["counters"]

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Security
security = HTTPBearer()
