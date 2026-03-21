from fastapi import APIRouter, Depends
from auth import verify_token
from config import accounts_collection
from services.financial import calculate_account_totals

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(current_user: dict = Depends(verify_token)):
    accounts = await accounts_collection.find().to_list(10000)
    total_landed = total_received = total_pending = total_pending_interest = 0.0
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


@router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(verify_token)):
    total_accounts = await accounts_collection.count_documents({})
    active_accounts = await accounts_collection.count_documents({"status": "continue"})
    closed_accounts = await accounts_collection.count_documents({"status": "closed"})
    return {
        "total_accounts": total_accounts,
        "active_accounts": active_accounts,
        "closed_accounts": closed_accounts
    }
