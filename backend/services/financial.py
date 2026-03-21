from datetime import datetime, timezone
from typing import List
from config import ledger_collection


def _entry_existed_at_payment(entry: dict, payment_date: datetime) -> bool:
    """Check if a landed entry existed on or before the payment date"""
    entry_date_str = entry.get("date", "")
    if not entry_date_str:
        return True
    entry_date = datetime.fromisoformat(entry_date_str)
    if entry_date.tzinfo is None:
        entry_date = entry_date.replace(tzinfo=timezone.utc)
    pd = payment_date if payment_date.tzinfo else payment_date.replace(tzinfo=timezone.utc)
    return entry_date <= pd


def calculate_interest_for_entry(landed_entry: dict, calc_date: datetime) -> dict:
    """
    Calculate interest for a single landed entry up to calc_date
    Formula: Interest = (Principal x Rate x Days) / (100 x 30)
    """
    try:
        interest_start_date_str = landed_entry.get("interest_start_date") or landed_entry.get("date")
        if not interest_start_date_str:
            return {"interest": 0.0, "days": 0, "interest_start_date": None}

        if isinstance(interest_start_date_str, str):
            interest_start_date = datetime.fromisoformat(interest_start_date_str.replace('Z', '+00:00'))
        else:
            interest_start_date = interest_start_date_str

        if interest_start_date.tzinfo is None:
            interest_start_date = interest_start_date.replace(tzinfo=timezone.utc)
        if calc_date.tzinfo is None:
            calc_date = calc_date.replace(tzinfo=timezone.utc)

        remaining_principal = float(landed_entry.get("remaining_principal") or landed_entry.get("amount", 0) or 0)
        if remaining_principal <= 0:
            return {"interest": 0.0, "days": 0, "interest_start_date": interest_start_date_str}

        interest_rate = float(landed_entry.get("interest_rate", 2) or 2)
        days = max(0, (calc_date - interest_start_date).days)
        calculated_interest = (remaining_principal * interest_rate * days) / (100 * 30)
        carried_forward = float(landed_entry.get("carried_forward_interest", 0.0) or 0.0)
        total_interest = calculated_interest + carried_forward

        return {
            "interest": round(total_interest, 2),
            "calculated_interest": round(calculated_interest, 2),
            "carried_forward_interest": round(carried_forward, 2),
            "days": days,
            "interest_start_date": interest_start_date_str
        }
    except Exception as e:
        print(f"Error calculating interest: {e}")
        return {"interest": 0.0, "days": 0, "interest_start_date": None}


def get_total_interest_for_entry(landed_entry: dict, calc_date: datetime) -> float:
    result = calculate_interest_for_entry(landed_entry, calc_date)
    return result.get("interest", 0.0)


def calculate_account_totals(account: dict) -> dict:
    """Calculate all account totals including interest"""
    now = datetime.now(timezone.utc)
    total_landed = sum(float(entry.get("amount", 0) or 0) for entry in account.get("landed_entries", []))
    total_received = sum(float(entry.get("amount", 0) or 0) for entry in account.get("received_entries", []))
    received_principal = sum(float(entry.get("principal_paid", 0) or 0) for entry in account.get("received_entries", []))
    received_interest = sum(float(entry.get("interest_paid", 0) or 0) for entry in account.get("received_entries", []))

    total_pending_principal = 0.0
    for entry in account.get("landed_entries", []):
        remaining = float(entry.get("remaining_principal") or entry.get("amount", 0) or 0)
        total_pending_principal += remaining

    total_pending_interest = 0.0
    for entry in account.get("landed_entries", []):
        remaining_principal = float(entry.get("remaining_principal") or entry.get("amount", 0) or 0)
        if remaining_principal > 0:
            total_pending_interest += get_total_interest_for_entry(entry, now)

    total_jewellery_weight = sum(float(item.get("weight", 0) or 0) for item in account.get("jewellery_items", []))

    return {
        "total_landed_amount": round(total_landed, 2),
        "total_received_amount": round(total_received, 2),
        "received_principal": round(received_principal, 2),
        "received_interest": round(received_interest, 2),
        "total_pending_amount": round(total_pending_principal, 2),
        "total_interest_amount": round(total_pending_interest, 2),
        "total_pending_interest": round(total_pending_interest, 2),
        "total_jewellery_weight": round(total_jewellery_weight, 2)
    }


def process_payment(landed_entries: List[dict], payment_amount: float, payment_date: datetime) -> tuple:
    """
    Process payment: interest first (for entries that existed at payment date), then principal (FIFO).
    Entries created AFTER payment date are not affected.
    """
    remaining_payment = float(payment_amount)
    total_interest_paid = 0.0
    total_principal_paid = 0.0
    remaining_interest_after_payment = 0.0

    total_interest_due = 0.0
    entry_interests = []
    for entry in landed_entries:
        if not _entry_existed_at_payment(entry, payment_date):
            entry_interests.append(0.0)
            continue
        remaining_principal = float(entry.get("remaining_principal") or entry.get("amount", 0) or 0)
        if remaining_principal > 0:
            entry_interest = get_total_interest_for_entry(entry, payment_date)
            entry_interests.append(entry_interest)
            total_interest_due += entry_interest
        else:
            entry_interests.append(0.0)

    if remaining_payment >= total_interest_due:
        total_interest_paid = total_interest_due
        remaining_payment -= total_interest_due
        for entry in landed_entries:
            if _entry_existed_at_payment(entry, payment_date):
                entry["carried_forward_interest"] = 0.0
                entry["interest_start_date"] = payment_date.isoformat()
        for entry in landed_entries:
            if remaining_payment <= 0:
                break
            if not _entry_existed_at_payment(entry, payment_date):
                continue
            remaining_principal = float(entry.get("remaining_principal") or entry.get("amount", 0) or 0)
            if remaining_principal > 0:
                principal_payment = min(remaining_payment, remaining_principal)
                entry["remaining_principal"] = remaining_principal - principal_payment
                total_principal_paid += principal_payment
                remaining_payment -= principal_payment
    else:
        total_interest_paid = remaining_payment
        remaining_interest_after_payment = total_interest_due - remaining_payment
        if total_interest_due > 0:
            for i, entry in enumerate(landed_entries):
                if not _entry_existed_at_payment(entry, payment_date):
                    continue
                remaining_principal = float(entry.get("remaining_principal") or entry.get("amount", 0) or 0)
                if remaining_principal > 0 and entry_interests[i] > 0:
                    proportion = entry_interests[i] / total_interest_due
                    entry_remaining_interest = remaining_interest_after_payment * proportion
                    entry["carried_forward_interest"] = round(entry_remaining_interest, 2)
                    entry["interest_start_date"] = payment_date.isoformat()

    return landed_entries, round(total_principal_paid, 2), round(total_interest_paid, 2), round(remaining_interest_after_payment, 2)


async def create_ledger_entry(account_id: str, transaction_type: str, amount: float,
                             principal_amount: float, interest_amount: float,
                             balance_amount: float, created_by: str, transaction_date: str = None,
                             remaining_interest: float = 0.0, remaining_principal: float = 0.0):
    if transaction_date:
        try:
            txn_date = datetime.fromisoformat(transaction_date)
            if txn_date.tzinfo is None:
                txn_date = txn_date.replace(tzinfo=timezone.utc)
        except:
            txn_date = datetime.now(timezone.utc)
    else:
        txn_date = datetime.now(timezone.utc)

    ledger_entry = {
        "account_id": account_id,
        "transaction_date": txn_date,
        "transaction_type": transaction_type,
        "amount": amount,
        "principal_amount": principal_amount,
        "interest_amount": interest_amount,
        "balance_amount": balance_amount,
        "remaining_interest": remaining_interest,
        "remaining_principal": remaining_principal,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc)
    }
    await ledger_collection.insert_one(ledger_entry)


async def generate_chronological_ledger(account_id: str, landed_entries: list, received_entries: list, created_by: str):
    """Generate ledger entries in chronological order for correct running balance"""
    all_entries = []
    for entry in landed_entries:
        all_entries.append({"type": "LANDED", "date": entry["date"], "data": entry})
    for entry in received_entries:
        all_entries.append({"type": "PAYMENT", "date": entry["date"], "data": entry})
    all_entries.sort(key=lambda x: x["date"])

    running_balance = 0.0
    for item in all_entries:
        entry = item["data"]
        if item["type"] == "LANDED":
            running_balance += float(entry["amount"])
            await create_ledger_entry(
                account_id, "LANDED", entry["amount"], entry["amount"], 0,
                running_balance, created_by, entry["date"],
                remaining_interest=0.0, remaining_principal=running_balance
            )
        else:
            running_balance -= float(entry.get("principal_paid", 0))
            await create_ledger_entry(
                account_id, "PAYMENT", entry["amount"],
                entry.get("principal_paid", 0), entry.get("interest_paid", 0),
                running_balance, created_by, entry["date"],
                remaining_interest=float(entry.get("remaining_interest", 0)),
                remaining_principal=running_balance
            )
