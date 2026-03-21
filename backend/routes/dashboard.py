from fastapi import APIRouter, Depends
from auth import verify_token
from config import accounts_collection
from services.financial import calculate_account_totals

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(current_user: dict = Depends(verify_token)):
    accounts = await accounts_collection.find().to_list(10000)
    # Active accounts totals
    active_landed = active_received = active_pending = active_interest = 0.0
    # Closed accounts totals
    closed_landed = closed_received = closed_pending = closed_interest = 0.0

    for account in accounts:
        totals = calculate_account_totals(account)
        if account.get("status") == "closed":
            closed_landed += totals["total_landed_amount"]
            closed_received += totals["total_received_amount"]
            closed_pending += totals["total_pending_amount"]
            closed_interest += totals["total_pending_interest"]
        else:
            active_landed += totals["total_landed_amount"]
            active_received += totals["total_received_amount"]
            active_pending += totals["total_pending_amount"]
            active_interest += totals["total_pending_interest"]

    return {
        "total_landed_amount": round(active_landed, 2),
        "total_received_amount": round(active_received, 2),
        "total_pending_amount": round(active_pending, 2),
        "total_pending_interest": round(active_interest, 2),
        "closed_total_landed_amount": round(closed_landed, 2),
        "closed_total_received_amount": round(closed_received, 2),
        "closed_total_pending_amount": round(closed_pending, 2),
        "closed_total_pending_interest": round(closed_interest, 2),
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
