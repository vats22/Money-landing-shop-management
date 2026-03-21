"""
Seed script for LendLedger database.
Creates sample accounts with varied data for development and testing.

Usage: cd /app/backend && python scripts/seed.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "lendledger")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SAMPLE_ACCOUNTS = [
    {
        "name": "Ramesh Patel",
        "village": "Rajkot",
        "opening_date": "2025-11-15",
        "details": "Gold chain and bangles pledged",
        "jewellery_items": [
            {"name": "Gold Chain 22K", "weight": 45.5},
            {"name": "Gold Bangles Pair", "weight": 32.0}
        ],
        "landed_entries": [
            {"date": "2025-11-15", "amount": 50000, "interest_rate": 2.0},
            {"date": "2025-12-20", "amount": 20000, "interest_rate": 2.5}
        ],
        "received_entries": [
            {"date": "2026-01-10", "amount": 5000}
        ]
    },
    {
        "name": "Suresh Kumar",
        "village": "Jamnagar",
        "opening_date": "2025-10-01",
        "details": "Silver items pledged",
        "jewellery_items": [
            {"name": "Silver Anklets Pair", "weight": 120.0},
            {"name": "Silver Necklace", "weight": 85.0}
        ],
        "landed_entries": [
            {"date": "2025-10-01", "amount": 30000, "interest_rate": 3.0}
        ],
        "received_entries": [
            {"date": "2025-11-15", "amount": 3000},
            {"date": "2025-12-30", "amount": 5000}
        ]
    },
    {
        "name": "Priya Sharma",
        "village": "Rajkot",
        "opening_date": "2026-01-05",
        "details": "Diamond ring and earrings",
        "jewellery_items": [
            {"name": "Diamond Ring", "weight": 8.5},
            {"name": "Gold Earrings", "weight": 12.0}
        ],
        "landed_entries": [
            {"date": "2026-01-05", "amount": 100000, "interest_rate": 2.0},
            {"date": "2026-02-01", "amount": 25000, "interest_rate": 2.5}
        ],
        "received_entries": [
            {"date": "2026-02-15", "amount": 10000},
            {"date": "2026-03-01", "amount": 15000}
        ]
    },
    {
        "name": "Mukesh Joshi",
        "village": "Morbi",
        "opening_date": "2025-12-10",
        "details": "Antique gold jewellery",
        "jewellery_items": [
            {"name": "Antique Gold Necklace", "weight": 65.0},
            {"name": "Gold Mang Tikka", "weight": 15.5},
            {"name": "Gold Earrings Heavy", "weight": 28.0}
        ],
        "landed_entries": [
            {"date": "2025-12-10", "amount": 80000, "interest_rate": 2.5}
        ],
        "received_entries": []
    },
    {
        "name": "Kiran Desai",
        "village": "Jamnagar",
        "opening_date": "2026-02-20",
        "details": "Gold coins and chain",
        "jewellery_items": [
            {"name": "Gold Coins (5 pcs)", "weight": 50.0},
            {"name": "Gold Rope Chain", "weight": 22.0}
        ],
        "landed_entries": [
            {"date": "2026-02-20", "amount": 40000, "interest_rate": 3.0},
            {"date": "2026-03-05", "amount": 15000, "interest_rate": 3.5}
        ],
        "received_entries": [
            {"date": "2026-03-10", "amount": 8000}
        ]
    },
    {
        "name": "Lakshmi Devi",
        "village": "Morbi",
        "opening_date": "2025-09-15",
        "details": "Traditional gold set",
        "jewellery_items": [
            {"name": "Bridal Gold Set", "weight": 150.0}
        ],
        "landed_entries": [
            {"date": "2025-09-15", "amount": 200000, "interest_rate": 2.0}
        ],
        "received_entries": [
            {"date": "2025-10-30", "amount": 20000},
            {"date": "2025-12-15", "amount": 30000},
            {"date": "2026-02-01", "amount": 25000}
        ]
    },
    {
        "name": "Anil Mehta",
        "village": "Gondal",
        "opening_date": "2026-01-20",
        "details": "Platinum ring and gold bracelet",
        "jewellery_items": [
            {"name": "Platinum Ring", "weight": 10.0},
            {"name": "Gold Bracelet", "weight": 35.0}
        ],
        "landed_entries": [
            {"date": "2026-01-20", "amount": 60000, "interest_rate": 2.5}
        ],
        "received_entries": [
            {"date": "2026-03-01", "amount": 10000}
        ]
    }
]

SAMPLE_USERS = [
    {
        "username": "operator1",
        "first_name": "Ravi",
        "last_name": "Shah",
        "mobile": "9111222333",
        "email": "ravi@lendledger.com",
        "password": "operator123",
        "status": "active",
        "is_admin": False,
        "permissions": {
            "accounts": {"view": True, "add": True, "update": True, "delete": False},
            "close_account": True
        }
    },
    {
        "username": "viewer1",
        "first_name": "Neha",
        "last_name": "Patel",
        "mobile": "9111222334",
        "email": "neha@lendledger.com",
        "password": "viewer123",
        "status": "active",
        "is_admin": False,
        "permissions": {
            "accounts": {"view": True, "add": False, "update": False, "delete": False}
        }
    }
]


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("Seeding LendLedger database...")

    # Import financial logic
    from services.financial import process_payment, generate_chronological_ledger

    # Seed users
    for user_data in SAMPLE_USERS:
        existing = await db.users.find_one({"username": user_data["username"]})
        if not existing:
            user_data["password"] = pwd_context.hash(user_data["password"])
            user_data["created_at"] = datetime.now(timezone.utc)
            user_data["created_by"] = "seed"
            user_data["updated_at"] = datetime.now(timezone.utc)
            user_data["updated_by"] = "seed"
            await db.users.insert_one(user_data)
            print(f"  Created user: {user_data['username']}")
        else:
            print(f"  User already exists: {user_data['username']}")

    # Seed accounts
    admin = await db.users.find_one({"username": "admin"})
    admin_id = str(admin["_id"]) if admin else "seed"

    for acct_data in SAMPLE_ACCOUNTS:
        # Check if account with same name exists
        existing = await db.accounts.find_one({"name": acct_data["name"]})
        if existing:
            print(f"  Account already exists: {acct_data['name']}")
            continue

        # Get next account number
        counter = await db.counters.find_one_and_update(
            {"_id": "account_number"}, {"$inc": {"seq": 1}},
            upsert=True, return_document=True
        )
        account_number = f"ACC{counter['seq']:06d}"

        # Initialize landed entries
        landed_entries = []
        for entry in acct_data["landed_entries"]:
            landed_entries.append({
                "date": entry["date"], "amount": float(entry["amount"]),
                "interest_rate": float(entry["interest_rate"]),
                "remaining_principal": float(entry["amount"]),
                "interest_start_date": entry["date"],
                "carried_forward_interest": 0.0
            })

        # Process received entries
        received_entries = []
        sorted_received = sorted(acct_data.get("received_entries", []), key=lambda x: x["date"])
        for recv in sorted_received:
            payment_date = datetime.fromisoformat(recv["date"])
            landed_entries, principal_paid, interest_paid, remaining_interest = process_payment(
                landed_entries, recv["amount"], payment_date
            )
            received_entries.append({
                "date": recv["date"], "amount": float(recv["amount"]),
                "principal_paid": principal_paid, "interest_paid": interest_paid,
                "remaining_interest": remaining_interest
            })

        account_doc = {
            "account_number": account_number,
            "opening_date": acct_data["opening_date"],
            "name": acct_data["name"],
            "village": acct_data["village"],
            "status": "continue",
            "details": acct_data.get("details", ""),
            "jewellery_items": acct_data["jewellery_items"],
            "landed_entries": landed_entries,
            "received_entries": received_entries,
            "created_at": datetime.now(timezone.utc),
            "created_by": admin_id,
            "created_by_name": "Master Admin",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": admin_id,
            "updated_by_name": "Master Admin"
        }

        result = await db.accounts.insert_one(account_doc)
        account_id = str(result.inserted_id)

        # Generate ledger
        await generate_chronological_ledger(account_id, landed_entries, received_entries, admin_id)

        print(f"  Created account: {account_number} - {acct_data['name']} ({acct_data['village']})")

    print("\nSeed completed successfully!")
    print(f"  Total accounts: {await db.accounts.count_documents({})}")
    print(f"  Total users: {await db.users.count_documents({})}")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
