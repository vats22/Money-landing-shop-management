from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
import math
from auth import verify_token, check_permission
from config import accounts_collection, ledger_collection
from models import AccountCreate, AccountUpdate, LandedEntry, ReceivedEntry, CloseAccountRequest, ReopenAccountRequest
from utils import serialize_doc, get_next_account_number
from services.financial import (
    calculate_account_totals, calculate_interest_for_entry,
    process_payment, create_ledger_entry, generate_chronological_ledger
)

router = APIRouter(prefix="/api", tags=["accounts"])


@router.get("/accounts")
async def get_accounts(
    current_user: dict = Depends(verify_token),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    village: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = "account_number",
    sort_order: str = "desc"
):
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "view"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.view")
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"account_number": {"$regex": search, "$options": "i"}}
        ]
    if village:
        query["village"] = {"$regex": village, "$options": "i"}
    if status:
        query["status"] = status
    if start_date and end_date:
        query["opening_date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["opening_date"] = {"$gte": start_date}
    elif end_date:
        query["opening_date"] = {"$lte": end_date}
    sort_direction = -1 if sort_order == "desc" else 1
    skip = (page - 1) * limit
    total = await accounts_collection.count_documents(query)
    accounts = await accounts_collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit).to_list(limit)
    enriched_accounts = []
    for account in accounts:
        totals = calculate_account_totals(account)
        account_data = serialize_doc(account)
        account_data.update(totals)
        enriched_accounts.append(account_data)
    return {
        "accounts": enriched_accounts, "total": total, "page": page,
        "limit": limit, "total_pages": math.ceil(total / limit) if total > 0 else 1
    }


@router.get("/accounts/{account_id}")
async def get_account(account_id: str, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "view"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.view")
    account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    now = datetime.now(timezone.utc)
    enriched_landed_entries = []
    for entry in account.get("landed_entries", []):
        entry_copy = dict(entry)
        interest_details = calculate_interest_for_entry(entry, now)
        entry_copy["calculated_interest"] = interest_details.get("calculated_interest", 0)
        entry_copy["carried_forward_interest"] = interest_details.get("carried_forward_interest", 0)
        entry_copy["total_interest"] = interest_details.get("interest", 0)
        entry_copy["days"] = interest_details.get("days", 0)
        entry_copy["interest_start_date"] = entry.get("interest_start_date") or entry.get("date")
        enriched_landed_entries.append(entry_copy)
    account["landed_entries"] = enriched_landed_entries
    totals = calculate_account_totals(account)
    account_data = serialize_doc(account)
    account_data.update(totals)
    account_data["user_can_edit"] = current_user.get("is_admin") or check_permission(current_user, "accounts", "update")
    account_data["user_can_delete"] = current_user.get("is_admin") or check_permission(current_user, "accounts", "delete")
    account_data["user_can_add"] = current_user.get("is_admin") or check_permission(current_user, "accounts", "add")
    account_data["user_can_close"] = current_user.get("is_admin") or check_permission(current_user, "accounts", "close")
    account_data["user_can_unlock"] = current_user.get("is_admin") or current_user.get("permissions", {}).get("unlock_closed_account", False)
    # Closed accounts cannot be edited/deleted - must be reopened first
    if account.get("status") == "closed":
        account_data["user_can_edit"] = False
        account_data["user_can_delete"] = False
        account_data["user_can_add"] = False
        account_data["user_can_close"] = False
    return account_data


@router.post("/accounts", status_code=201)
async def create_account(account: AccountCreate, current_user: dict = Depends(verify_token)):
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "add"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.add")
    account_number = await get_next_account_number()
    landed_entries = []
    for entry in account.landed_entries:
        entry_dict = entry.model_dump()
        entry_dict["remaining_principal"] = entry.amount
        entry_dict["interest_start_date"] = entry.date
        entry_dict["carried_forward_interest"] = 0.0
        landed_entries.append(entry_dict)
    received_entries = []
    if account.received_entries:
        sorted_received = sorted(account.received_entries, key=lambda x: x.date)
        for recv_entry in sorted_received:
            payment_date = datetime.fromisoformat(recv_entry.date)
            landed_entries, principal_paid, interest_paid, remaining_interest = process_payment(
                landed_entries, recv_entry.amount, payment_date
            )
            recv_dict = recv_entry.model_dump()
            recv_dict["principal_paid"] = principal_paid
            recv_dict["interest_paid"] = interest_paid
            recv_dict["remaining_interest"] = remaining_interest
            received_entries.append(recv_dict)
    user_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username')
    account_doc = {
        "account_number": f"ACC{account_number:06d}",
        "opening_date": account.opening_date, "name": account.name,
        "village": account.village, "status": account.status, "details": account.details,
        "jewellery_items": [item.model_dump() for item in account.jewellery_items],
        "landed_entries": landed_entries, "received_entries": received_entries,
        "created_at": datetime.now(timezone.utc), "created_by": str(current_user["_id"]),
        "created_by_name": user_name,
        "updated_at": datetime.now(timezone.utc), "updated_by": str(current_user["_id"]),
        "updated_by_name": user_name
    }
    result = await accounts_collection.insert_one(account_doc)
    account_doc["_id"] = result.inserted_id
    await generate_chronological_ledger(str(result.inserted_id), landed_entries, received_entries, str(current_user["_id"]))
    totals = calculate_account_totals(account_doc)
    response = serialize_doc(account_doc)
    response.update(totals)
    return response


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, account: AccountUpdate, current_user: dict = Depends(verify_token)):
    existing = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "update"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.update")
    if existing.get("status") == "closed":
        raise HTTPException(status_code=403, detail="Cannot modify a closed account. Please reopen it first.")
    update_data = {k: v for k, v in account.model_dump().items() if v is not None}
    if "jewellery_items" in update_data:
        jewellery_items = []
        for item in update_data["jewellery_items"]:
            if isinstance(item, dict) and item.get("name") and item.get("weight"):
                jewellery_items.append({"name": item["name"], "weight": float(item["weight"])})
        update_data["jewellery_items"] = jewellery_items
    if "landed_entries" in update_data:
        landed_entries = []
        for entry in update_data["landed_entries"]:
            if isinstance(entry, dict) and entry.get("date") and entry.get("amount"):
                landed_entries.append({
                    "date": entry["date"], "amount": float(entry["amount"]),
                    "interest_rate": float(entry.get("interest_rate", 2)),
                    "remaining_principal": float(entry["amount"]),
                    "interest_start_date": entry["date"], "carried_forward_interest": 0.0
                })
        update_data["landed_entries"] = landed_entries
    else:
        landed_entries = existing.get("landed_entries", [])
        for entry in landed_entries:
            entry["remaining_principal"] = float(entry["amount"])
            entry["interest_start_date"] = entry["date"]
            entry["carried_forward_interest"] = 0.0
        update_data["landed_entries"] = landed_entries
    if "received_entries" in update_data:
        landed_entries = update_data["landed_entries"]
        received_entries = []
        raw_received = sorted(
            [e for e in update_data["received_entries"] if isinstance(e, dict) and e.get("date") and e.get("amount")],
            key=lambda x: x["date"]
        )
        for recv_entry in raw_received:
            payment_date = datetime.fromisoformat(recv_entry["date"])
            payment_amount = float(recv_entry["amount"])
            landed_entries, principal_paid, interest_paid, remaining_interest = process_payment(
                landed_entries, payment_amount, payment_date
            )
            received_entries.append({
                "date": recv_entry["date"], "amount": payment_amount,
                "principal_paid": principal_paid, "interest_paid": interest_paid,
                "remaining_interest": remaining_interest
            })
        update_data["received_entries"] = received_entries
        update_data["landed_entries"] = landed_entries
    user_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username')
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = str(current_user["_id"])
    update_data["updated_by_name"] = user_name
    await accounts_collection.update_one({"_id": ObjectId(account_id)}, {"$set": update_data})
    await ledger_collection.delete_many({"account_id": account_id})
    updated_account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    await generate_chronological_ledger(
        account_id, updated_account.get("landed_entries", []),
        updated_account.get("received_entries", []), str(current_user["_id"])
    )
    totals = calculate_account_totals(updated_account)
    response = serialize_doc(updated_account)
    response.update(totals)
    return response


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, current_user: dict = Depends(verify_token)):
    existing = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "delete"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.delete")
    if existing.get("status") == "closed":
        raise HTTPException(status_code=403, detail="Cannot delete a closed account. Please reopen it first.")
    await accounts_collection.delete_one({"_id": ObjectId(account_id)})
    await ledger_collection.delete_many({"account_id": account_id})
    return {"message": "Account deleted successfully"}


@router.post("/accounts/{account_id}/close")
async def close_account(account_id: str, request: CloseAccountRequest, current_user: dict = Depends(verify_token)):
    existing = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "close"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.close")
    if existing.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Account is already closed")
    totals = calculate_account_totals(existing)
    close_date = datetime.fromisoformat(request.close_date)
    user_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username')
    close_entry = {
        "closed_at": close_date.isoformat(), "closed_by": str(current_user["_id"]),
        "closed_by_name": user_name, "remarks": request.remarks,
        "final_pending_amount": totals["total_pending_amount"],
        "final_pending_interest": totals["total_pending_interest"]
    }
    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {
            "status": "closed", "closed_at": close_date,
            "closed_by": str(current_user["_id"]), "closed_by_name": user_name,
            "close_remarks": request.remarks,
            "final_pending_amount": totals["total_pending_amount"],
            "final_pending_interest": totals["total_pending_interest"],
            "updated_at": datetime.now(timezone.utc), "updated_by": str(current_user["_id"])
        },
         "$push": {"close_history": close_entry}}
    )
    await create_ledger_entry(
        account_id, "CLOSED", 0, 0, 0, totals["total_pending_amount"],
        str(current_user["_id"]), request.close_date,
        remaining_interest=0.0, remaining_principal=totals["total_pending_amount"]
    )
    return {
        "message": "Account closed successfully", "closed_at": request.close_date,
        "final_pending_amount": totals["total_pending_amount"],
        "final_pending_interest": totals["total_pending_interest"]
    }


@router.post("/accounts/{account_id}/reopen")
async def reopen_account(account_id: str, request: ReopenAccountRequest, current_user: dict = Depends(verify_token)):
    existing = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    if not current_user.get("is_admin") and not current_user.get("permissions", {}).get("unlock_closed_account"):
        raise HTTPException(status_code=403, detail="Permission denied: Only users with 'Unlock Closed Account' permission can reopen accounts")
    if existing.get("status") != "closed":
        raise HTTPException(status_code=400, detail="Account is not closed")
    if not request.reason or not request.reason.strip():
        raise HTTPException(status_code=400, detail="Reason for reopening is mandatory")
    reopen_date = datetime.now(timezone.utc)
    user_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username')
    reopen_entry = {
        "reopened_at": reopen_date.isoformat(), "reopened_by": str(current_user["_id"]),
        "reopened_by_name": user_name, "reason": request.reason
    }
    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"status": "continue", "updated_at": reopen_date, "updated_by": str(current_user["_id"])},
         "$push": {"reopen_history": reopen_entry}}
    )
    await create_ledger_entry(
        account_id, "REOPENED", 0, 0, 0, existing.get("final_pending_amount", 0),
        str(current_user["_id"]), reopen_date.isoformat(),
        remaining_interest=0.0, remaining_principal=existing.get("final_pending_amount", 0)
    )
    return {"message": "Account reopened successfully", "reopened_at": reopen_date.isoformat(), "reason": request.reason}


@router.post("/accounts/{account_id}/landed")
async def add_landed_entry(account_id: str, entry: LandedEntry, current_user: dict = Depends(verify_token)):
    account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "add"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.add")
    if account.get("status") == "closed":
        raise HTTPException(status_code=403, detail="Cannot add entries to a closed account. Please reopen it first.")
    entry_dict = entry.model_dump()
    entry_dict["remaining_principal"] = entry.amount
    entry_dict["interest_start_date"] = entry.date
    entry_dict["carried_forward_interest"] = 0.0
    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {"$push": {"landed_entries": entry_dict},
         "$set": {"updated_at": datetime.now(timezone.utc), "updated_by": str(current_user["_id"])}}
    )
    updated_account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    totals = calculate_account_totals(updated_account)
    await create_ledger_entry(
        account_id, "LANDED", entry.amount, entry.amount, 0,
        totals["total_pending_amount"], str(current_user["_id"]), entry.date
    )
    return {"message": "Landed entry added successfully"}


@router.post("/accounts/{account_id}/received")
async def add_received_entry(account_id: str, entry: ReceivedEntry, current_user: dict = Depends(verify_token)):
    account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if not current_user.get("is_admin") and not check_permission(current_user, "accounts", "add"):
        raise HTTPException(status_code=403, detail="Permission denied: accounts.add")
    if account.get("status") == "closed":
        raise HTTPException(status_code=403, detail="Cannot add entries to a closed account. Please reopen it first.")
    payment_date = datetime.fromisoformat(entry.date)
    landed_entries = account.get("landed_entries", [])
    landed_entries, principal_paid, interest_paid, remaining_interest = process_payment(
        landed_entries, entry.amount, payment_date
    )
    recv_dict = entry.model_dump()
    recv_dict["principal_paid"] = principal_paid
    recv_dict["interest_paid"] = interest_paid
    recv_dict["remaining_interest"] = remaining_interest
    await accounts_collection.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"landed_entries": landed_entries, "updated_at": datetime.now(timezone.utc),
                  "updated_by": str(current_user["_id"])},
         "$push": {"received_entries": recv_dict}}
    )
    running_balance = sum(float(e.get("remaining_principal", e.get("amount", 0))) for e in landed_entries)
    await create_ledger_entry(
        account_id, "PAYMENT", entry.amount, principal_paid, interest_paid,
        running_balance, str(current_user["_id"]), entry.date,
        remaining_interest=remaining_interest, remaining_principal=running_balance
    )
    return {"message": "Payment received successfully", "principal_paid": principal_paid,
            "interest_paid": interest_paid, "remaining_interest": remaining_interest}


@router.get("/ledger/{account_id}")
async def get_account_ledger(account_id: str, current_user: dict = Depends(verify_token)):
    ledger_entries = await ledger_collection.find({"account_id": account_id}).sort("transaction_date", 1).to_list(1000)
    return serialize_doc(ledger_entries)


@router.get("/villages")
async def get_villages(current_user: dict = Depends(verify_token)):
    villages = await accounts_collection.distinct("village")
    return villages
