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
        villages = [v.strip() for v in village.split(',') if v.strip()]
        if len(villages) == 1:
            query["village"] = {"$regex": villages[0], "$options": "i"}
        elif len(villages) > 1:
            query["village"] = {"$in": [v for v in villages]}
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

    # Whether landed/received entries are being modified in this request.
    # If neither is touched, do NOT reset/reprocess existing entries (was corrupting paid-off state).
    landed_in_payload = "landed_entries" in update_data
    received_in_payload = "received_entries" in update_data

    if landed_in_payload or received_in_payload:
        # Build the working landed list
        if landed_in_payload:
            landed_entries = []
            for entry in update_data["landed_entries"]:
                if isinstance(entry, dict) and entry.get("date") and entry.get("amount"):
                    landed_entries.append({
                        "date": entry["date"], "amount": float(entry["amount"]),
                        "interest_rate": float(entry.get("interest_rate", 2)),
                        "remaining_principal": float(entry["amount"]),
                        "interest_start_date": entry["date"], "carried_forward_interest": 0.0
                    })
        else:
            # Received changed but landed not — start landed fresh from existing amounts and reprocess all
            landed_entries = []
            for entry in (existing.get("landed_entries") or []):
                landed_entries.append({
                    "date": entry["date"], "amount": float(entry["amount"]),
                    "interest_rate": float(entry.get("interest_rate", 2)),
                    "remaining_principal": float(entry["amount"]),
                    "interest_start_date": entry["date"], "carried_forward_interest": 0.0
                })

        # Reprocess received against landed
        raw_received = update_data.get("received_entries") if received_in_payload else (existing.get("received_entries") or [])
        received_entries = []
        sorted_received = sorted(
            [e for e in raw_received if isinstance(e, dict) and e.get("date") and e.get("amount")],
            key=lambda x: x["date"]
        )
        for recv_entry in sorted_received:
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
        update_data["landed_entries"] = landed_entries
        update_data["received_entries"] = received_entries
    # else: leave landed_entries/received_entries on existing doc unchanged

    user_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('username')
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = str(current_user["_id"])
    update_data["updated_by_name"] = user_name

    # Bug fix: when status is changed to "closed" via the form's status dropdown,
    # mirror the dedicated /close endpoint behavior so it appears in the History tab.
    push_ops = {}
    new_status = update_data.get("status")
    if new_status == "closed" and existing.get("status") != "closed":
        temp_account = {**existing, **update_data}
        close_totals = calculate_account_totals(temp_account)
        close_date = datetime.now(timezone.utc)
        close_entry = {
            "closed_at": close_date.isoformat(),
            "closed_by": str(current_user["_id"]),
            "closed_by_name": user_name,
            "remarks": "Closed via status dropdown",
            "final_pending_amount": close_totals["total_pending_amount"],
            "final_pending_interest": close_totals["total_pending_interest"]
        }
        update_data["closed_at"] = close_date
        update_data["closed_by"] = str(current_user["_id"])
        update_data["closed_by_name"] = user_name
        update_data["close_remarks"] = close_entry["remarks"]
        update_data["final_pending_amount"] = close_totals["total_pending_amount"]
        update_data["final_pending_interest"] = close_totals["total_pending_interest"]
        push_ops["close_history"] = close_entry

    mongo_update = {"$set": update_data}
    if push_ops:
        mongo_update["$push"] = push_ops
    await accounts_collection.update_one({"_id": ObjectId(account_id)}, mongo_update)
    await ledger_collection.delete_many({"account_id": account_id})
    updated_account = await accounts_collection.find_one({"_id": ObjectId(account_id)})
    await generate_chronological_ledger(
        account_id, updated_account.get("landed_entries", []),
        updated_account.get("received_entries", []), str(current_user["_id"])
    )
    # If we just closed via dropdown, append a CLOSED ledger entry too (parity with /close endpoint)
    if push_ops.get("close_history"):
        ce = push_ops["close_history"]
        await create_ledger_entry(
            account_id, "CLOSED", 0, 0, 0, ce["final_pending_amount"],
            str(current_user["_id"]), ce["closed_at"],
            remaining_interest=0.0, remaining_principal=ce["final_pending_amount"]
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
    # Validate entry date is not before account opening date
    opening_date = account.get("opening_date", "")
    if opening_date and entry.date < opening_date:
        raise HTTPException(status_code=400, detail=f"Entry date cannot be before account opening date ({opening_date})")
    # Validate entry date is not in the future
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if entry.date > today_str:
        raise HTTPException(status_code=400, detail="Entry date cannot be in the future")
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
    # Validate entry date is not before account opening date
    opening_date = account.get("opening_date", "")
    if opening_date and entry.date < opening_date:
        raise HTTPException(status_code=400, detail=f"Entry date cannot be before account opening date ({opening_date})")
    # Validate entry date is not in the future
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if entry.date > today_str:
        raise HTTPException(status_code=400, detail="Entry date cannot be in the future")
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


@router.get("/ledger-enhanced/{account_id}")
async def get_enhanced_ledger(account_id: str, current_user: dict = Depends(verify_token)):
    """
    Enhanced ledger with computed notes, interest charged, breakdown, and proper balance.
    Re-simulates payments chronologically to expose per-entry breakdown (principal, rate, days, interest)
    without touching the underlying DB schema. Notes are generated dynamically.
    """
    account = await accounts_collection.find_one({"account_number": account_id}) or \
              await accounts_collection.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    landed_src = account.get("landed_entries", []) or []
    received_src = account.get("received_entries", []) or []

    # Build chronological timeline (LANDED + PAYMENT)
    timeline = []
    for e in landed_src:
        timeline.append({"type": "LANDED", "date": e.get("date", ""), "ref": e})
    for r in received_src:
        timeline.append({"type": "PAYMENT", "date": r.get("date", ""), "ref": r})
    timeline.sort(key=lambda x: x["date"])

    # Active landed entries (live state during simulation)
    active = []  # each: {date, rate, remaining_principal, interest_start_date, carried_forward_interest}
    rows = []
    landed_count = 0
    total_interest_charged = 0.0
    total_interest_paid = 0.0

    for t in timeline:
        if t["type"] == "LANDED":
            ref = t["ref"]
            le = {
                "date": ref.get("date", ""),
                "rate": float(ref.get("interest_rate", 2) or 2),
                "remaining_principal": float(ref.get("amount", 0) or 0),
                "interest_start_date": ref.get("date", ""),
                "carried_forward_interest": 0.0,
                "original_amount": float(ref.get("amount", 0) or 0),
            }
            active.append(le)
            landed_count += 1
            running_principal = sum(x["remaining_principal"] for x in active)
            running_interest = sum(x["carried_forward_interest"] for x in active)
            rows.append({
                "transaction_type": "LANDED",
                "transaction_date": ref.get("date", ""),
                "amount": le["original_amount"],
                "interest_charged": 0,
                "interest_amount": 0,
                "principal_amount": 0,
                "remaining_principal": round(running_principal, 2),
                "remaining_interest": round(running_interest, 2),
                "computed_balance": round(running_principal + running_interest, 2),
                "breakdown": [{
                    "landed_date": le["date"],
                    "interest_start_date": le["interest_start_date"],
                    "principal": round(le["original_amount"], 2),
                    "rate": le["rate"],
                    "days": 0,
                    "interest_due": 0,
                    "interest_paid": 0,
                    "principal_paid": 0,
                }],
                "notes": "Loan disbursed" if landed_count == 1 else "Additional loan added",
            })
            continue

        # PAYMENT
        ref = t["ref"]
        try:
            payment_date = datetime.fromisoformat(ref.get("date", ""))
        except Exception:
            payment_date = datetime.now(timezone.utc)
        if payment_date.tzinfo is None:
            payment_date = payment_date.replace(tzinfo=timezone.utc)
        payment_amount = float(ref.get("amount", 0) or 0)

        # Capture per-entry interest snapshot at payment_date
        breakdown = []
        total_interest_due = 0.0
        for le in active:
            if le["remaining_principal"] <= 0:
                continue
            try:
                isd = datetime.fromisoformat(le["interest_start_date"])
            except Exception:
                isd = payment_date
            if isd.tzinfo is None:
                isd = isd.replace(tzinfo=timezone.utc)
            days = max(0, (payment_date - isd).days)
            calc_int = (le["remaining_principal"] * le["rate"] * days) / (100 * 30)
            interest_due = round(calc_int + le["carried_forward_interest"], 2)
            breakdown.append({
                "landed_date": le["date"],
                "interest_start_date": le["interest_start_date"],
                "principal": round(le["remaining_principal"], 2),
                "rate": le["rate"],
                "days": days,
                "calculated_interest": round(calc_int, 2),
                "carried_forward": round(le["carried_forward_interest"], 2),
                "interest_due": interest_due,
                "interest_paid": 0.0,
                "principal_paid": 0.0,
                "_le": le,  # internal ref for matching
            })
            total_interest_due += interest_due

        remaining = payment_amount
        interest_paid_total = 0.0
        principal_paid_total = 0.0

        if remaining >= total_interest_due:
            # Full interest cleared
            interest_paid_total = total_interest_due
            remaining -= total_interest_due
            for b in breakdown:
                b["interest_paid"] = b["interest_due"]
                b["_le"]["carried_forward_interest"] = 0.0
                b["_le"]["interest_start_date"] = ref.get("date", "")
            # FIFO principal repayment
            for le in active:
                if remaining <= 0:
                    break
                if le["remaining_principal"] <= 0:
                    continue
                pay_p = min(remaining, le["remaining_principal"])
                le["remaining_principal"] -= pay_p
                principal_paid_total += pay_p
                remaining -= pay_p
                for b in breakdown:
                    if b["_le"] is le:
                        b["principal_paid"] = round(b["principal_paid"] + pay_p, 2)
                        break
        else:
            # Partial interest
            interest_paid_total = remaining
            if total_interest_due > 0:
                for b in breakdown:
                    if b["interest_due"] <= 0:
                        continue
                    proportion = b["interest_due"] / total_interest_due
                    paid_for_this = round(remaining * proportion, 2)
                    cf = round(b["interest_due"] - paid_for_this, 2)
                    b["interest_paid"] = paid_for_this
                    b["_le"]["carried_forward_interest"] = cf
                    b["_le"]["interest_start_date"] = ref.get("date", "")
            remaining = 0

        # Strip internal refs
        for b in breakdown:
            b.pop("_le", None)

        running_principal = sum(le["remaining_principal"] for le in active)
        running_interest = sum(le["carried_forward_interest"] for le in active)
        remaining_interest_after = round(running_interest, 2)

        # Build dynamic notes (split new vs carry-forward interest for clarity)
        notes_parts = []
        active_breakdown = [b for b in breakdown if b["interest_due"] > 0 or b["principal_paid"] > 0]
        new_interest_total = round(sum(b.get("calculated_interest", 0) for b in active_breakdown), 2)
        carried_total = round(sum(b.get("carried_forward", 0) for b in active_breakdown), 2)

        if len(active_breakdown) == 1 and active_breakdown[0]["days"] > 0:
            b = active_breakdown[0]
            head = f"Interest for {b['days']} days @{b['rate']}% = {_fmt_inr(b['calculated_interest'])}"
            if (b.get("carried_forward") or 0) > 0:
                head += f" + Previous interest {_fmt_inr(b['carried_forward'])}. Total {_fmt_inr(b['interest_due'])}"
            notes_parts.append(head)
        elif len(active_breakdown) > 1:
            head = f"Interest across {len(active_breakdown)} entries: New {_fmt_inr(new_interest_total)}"
            if carried_total > 0:
                head += f" + Carry forward {_fmt_inr(carried_total)}"
            head += f". Total {_fmt_inr(round(new_interest_total + carried_total, 2))}"
            notes_parts.append(head)

        if interest_paid_total > 0 and principal_paid_total > 0 and remaining_interest_after == 0:
            notes_parts.append(f"Interest cleared, {_fmt_inr(principal_paid_total)} applied to principal")
        elif interest_paid_total > 0 and remaining_interest_after > 0:
            notes_parts.append(f"Partial interest paid, {_fmt_inr(remaining_interest_after)} carried forward")
        elif interest_paid_total > 0 and principal_paid_total == 0:
            notes_parts.append("Interest paid in full")
        elif principal_paid_total > 0 and interest_paid_total == 0:
            notes_parts.append(f"Principal reduced by {_fmt_inr(principal_paid_total)}")

        notes = ". ".join(notes_parts) + "." if notes_parts else "Payment received"

        total_interest_charged += round(total_interest_due, 2)
        total_interest_paid += round(interest_paid_total, 2)

        rows.append({
            "transaction_type": "PAYMENT",
            "transaction_date": ref.get("date", ""),
            "amount": payment_amount,
            "interest_charged": round(total_interest_due, 2),
            "interest_amount": round(interest_paid_total, 2),
            "principal_amount": round(principal_paid_total, 2),
            "remaining_principal": round(running_principal, 2),
            "remaining_interest": remaining_interest_after,
            "computed_balance": round(running_principal + remaining_interest_after, 2),
            "breakdown": breakdown,
            "notes": notes,
        })

    # Append CLOSED / REOPENED events (chronologically merged)
    events = []
    for h in (account.get("close_history") or []):
        events.append({"type": "CLOSED", "date": h.get("closed_at", ""), "by": h.get("closed_by_name", ""),
                       "remarks": h.get("remarks", ""),
                       "pending_principal": float(h.get("final_pending_amount", 0) or 0),
                       "pending_interest": float(h.get("final_pending_interest", 0) or 0)})
    for h in (account.get("reopen_history") or []):
        events.append({"type": "REOPENED", "date": h.get("reopened_at", ""), "by": h.get("reopened_by_name", ""),
                       "reason": h.get("reason", "")})

    for ev in events:
        try:
            d = ev["date"]
            if isinstance(d, str):
                if d.endswith("Z"):
                    d = d[:-1] + "+00:00"
                parsed = datetime.fromisoformat(d)
            else:
                parsed = d
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            ev["_sort"] = parsed
        except Exception:
            ev["_sort"] = datetime.now(timezone.utc)

    for ev in sorted(events, key=lambda x: x["_sort"]):
        if ev["type"] == "CLOSED":
            rows.append({
                "transaction_type": "CLOSED",
                "transaction_date": ev["date"],
                "amount": 0,
                "interest_charged": 0,
                "interest_amount": 0,
                "principal_amount": 0,
                "remaining_principal": ev["pending_principal"],
                "remaining_interest": ev["pending_interest"],
                "computed_balance": round(ev["pending_principal"] + ev["pending_interest"], 2),
                "breakdown": [],
                "notes": f"Account closed by {ev['by']}" + (f" — {ev['remarks']}" if ev.get("remarks") else ""),
            })
        else:
            rows.append({
                "transaction_type": "REOPENED",
                "transaction_date": ev["date"],
                "amount": 0,
                "interest_charged": 0,
                "interest_amount": 0,
                "principal_amount": 0,
                "remaining_principal": 0,
                "remaining_interest": 0,
                "computed_balance": 0,
                "breakdown": [],
                "notes": f"Account reopened by {ev['by']}" + (f" — {ev['reason']}" if ev.get("reason") else ""),
            })

    summary = {
        "total_interest_charged": round(total_interest_charged, 2),
        "total_interest_paid": round(total_interest_paid, 2),
        "pending_interest": round(total_interest_charged - total_interest_paid, 2),
    }

    return {"entries": rows, "summary": summary}


def _fmt_inr(val):
    """Format as Indian Rupees with ₹ symbol and 2 decimals using Indian numbering."""
    try:
        amt = float(val)
    except Exception:
        return f"₹{val}"
    sign = "-" if amt < 0 else ""
    amt = abs(amt)
    # Indian numbering: e.g. 12,34,567.89
    int_part, dec_part = f"{amt:.2f}".split(".")
    if len(int_part) > 3:
        last3 = int_part[-3:]
        rest = int_part[:-3]
        # Group rest in 2s from right
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        int_part = ",".join(groups) + "," + last3
    return f"{sign}₹{int_part}.{dec_part}"


@router.get("/villages")
async def get_villages(current_user: dict = Depends(verify_token)):
    villages = await accounts_collection.distinct("village")
    return villages
