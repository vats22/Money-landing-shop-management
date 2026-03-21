from fastapi import APIRouter, Depends
from auth import verify_token
from config import accounts_collection
from services.financial import calculate_account_totals

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/village-summary")
async def village_summary_report(current_user: dict = Depends(verify_token)):
    accounts = await accounts_collection.find().to_list(10000)
    village_data = {}
    for account in accounts:
        village = account.get("village", "Unknown")
        if village not in village_data:
            village_data[village] = {"village": village, "total_accounts": 0, "active_accounts": 0,
                                     "total_landed": 0, "total_received": 0, "total_pending": 0, "total_interest": 0}
        village_data[village]["total_accounts"] += 1
        if account.get("status") == "continue":
            village_data[village]["active_accounts"] += 1
        totals = calculate_account_totals(account)
        village_data[village]["total_landed"] += totals["total_landed_amount"]
        village_data[village]["total_received"] += totals["total_received_amount"]
        village_data[village]["total_pending"] += totals["total_pending_amount"]
        village_data[village]["total_interest"] += totals["total_pending_interest"]
    result = []
    for v in village_data.values():
        result.append({k: round(v2, 2) if isinstance(v2, float) else v2 for k, v2 in v.items()})
    return sorted(result, key=lambda x: x["total_pending"], reverse=True)


@router.get("/monthly-trend")
async def monthly_trend_report(current_user: dict = Depends(verify_token)):
    accounts = await accounts_collection.find().to_list(10000)
    monthly_data = {}
    for account in accounts:
        for entry in account.get("landed_entries", []):
            month_key = entry.get("date", "")[:7]
            if month_key:
                if month_key not in monthly_data:
                    monthly_data[month_key] = {"month": month_key, "landed": 0, "received": 0, "accounts_opened": 0}
                monthly_data[month_key]["landed"] += float(entry.get("amount", 0))
        for entry in account.get("received_entries", []):
            month_key = entry.get("date", "")[:7]
            if month_key:
                if month_key not in monthly_data:
                    monthly_data[month_key] = {"month": month_key, "landed": 0, "received": 0, "accounts_opened": 0}
                monthly_data[month_key]["received"] += float(entry.get("amount", 0))
        opening_month = account.get("opening_date", "")[:7]
        if opening_month:
            if opening_month not in monthly_data:
                monthly_data[opening_month] = {"month": opening_month, "landed": 0, "received": 0, "accounts_opened": 0}
            monthly_data[opening_month]["accounts_opened"] += 1
    result = []
    for v in monthly_data.values():
        result.append({k: round(v2, 2) if isinstance(v2, float) else v2 for k, v2 in v.items()})
    return sorted(result, key=lambda x: x["month"])


@router.get("/interest-rate-distribution")
async def interest_rate_distribution(current_user: dict = Depends(verify_token)):
    accounts = await accounts_collection.find({"status": "continue"}).to_list(10000)
    rate_data = {}
    for account in accounts:
        for entry in account.get("landed_entries", []):
            remaining = float(entry.get("remaining_principal") or entry.get("amount", 0) or 0)
            if remaining > 0:
                rate = str(entry.get("interest_rate", 0))
                if rate not in rate_data:
                    rate_data[rate] = {"rate": f"{rate}%", "count": 0, "total_amount": 0}
                rate_data[rate]["count"] += 1
                rate_data[rate]["total_amount"] += remaining
    result = []
    for v in rate_data.values():
        result.append({k: round(v2, 2) if isinstance(v2, float) else v2 for k, v2 in v.items()})
    return sorted(result, key=lambda x: float(x["rate"].replace("%", "")))


@router.get("/top-borrowers")
async def top_borrowers_report(current_user: dict = Depends(verify_token)):
    accounts = await accounts_collection.find().to_list(10000)
    borrowers = []
    for account in accounts:
        totals = calculate_account_totals(account)
        if totals["total_pending_amount"] > 0:
            borrowers.append({
                "account_number": account.get("account_number"),
                "name": account.get("name"), "village": account.get("village"),
                "total_landed": totals["total_landed_amount"],
                "total_pending": totals["total_pending_amount"],
                "total_interest": totals["total_pending_interest"],
                "status": account.get("status")
            })
    return sorted(borrowers, key=lambda x: x["total_pending"], reverse=True)[:20]
