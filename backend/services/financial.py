"""
Financial services for LendLedger.

Payment-allocation algorithm (rewritten Jun 2026, iteration 18):

Each receiving (payment) is applied to landed entries SEQUENTIALLY, not pro-rata.
For each landed entry in the allocation order:
    1. compute total interest currently due (calculated since interest_start_date + any
       previously-carried interest),
    2. apply payment to that interest first,
    3. apply any remainder to that entry's principal,
    4. roll any leftover forward to the next entry in the order.

Order:
    * FIFO (default) — landed entries sorted by date ascending. Entries created
      AFTER the payment date are skipped.
    * Manual — caller supplies an ordered list of {landed_index, amount} pairs;
      each pair is applied to the named entry (still interest-first-then-principal
      within that entry). Any "amount" on a manual allocation is the total
      assigned to that entry — not split further by the caller.
"""

from datetime import datetime, timezone
from typing import List, Optional
from config import ledger_collection


def _remaining_principal(entry: dict) -> float:
    """Return remaining_principal respecting 0.0 (don't fall back to amount when fully paid)."""
    rp = entry.get("remaining_principal")
    if rp is None:
        rp = entry.get("amount", 0)
    try:
        return float(rp or 0)
    except (TypeError, ValueError):
        return 0.0


def _entry_existed_at_payment(entry: dict, payment_date: datetime) -> bool:
    """Check if a landed entry existed on or before the payment date."""
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
    Interest for a single landed entry up to calc_date.
    Formula: Interest = (Remaining_Principal x Rate x Days) / (100 x 30)
    Days are counted from interest_start_date (or first landed date).
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

        remaining_principal = _remaining_principal(landed_entry)
        if remaining_principal <= 0:
            return {
                "interest": 0.0,
                "calculated_interest": 0.0,
                "carried_forward_interest": float(landed_entry.get("carried_forward_interest", 0.0) or 0.0),
                "days": 0,
                "interest_start_date": interest_start_date_str,
            }

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
            "interest_start_date": interest_start_date_str,
        }
    except Exception as e:
        print(f"Error calculating interest: {e}")
        return {"interest": 0.0, "days": 0, "interest_start_date": None}


def get_total_interest_for_entry(landed_entry: dict, calc_date: datetime) -> float:
    result = calculate_interest_for_entry(landed_entry, calc_date)
    return result.get("interest", 0.0)


def calculate_account_totals(account: dict) -> dict:
    """Calculate all account totals including interest."""
    now = datetime.now(timezone.utc)
    total_landed = sum(float(entry.get("amount", 0) or 0) for entry in account.get("landed_entries", []))
    total_received = sum(float(entry.get("amount", 0) or 0) for entry in account.get("received_entries", []))
    received_principal = sum(float(entry.get("principal_paid", 0) or 0) for entry in account.get("received_entries", []))
    received_interest = sum(float(entry.get("interest_paid", 0) or 0) for entry in account.get("received_entries", []))

    total_pending_principal = 0.0
    for entry in account.get("landed_entries", []):
        total_pending_principal += _remaining_principal(entry)

    total_pending_interest = 0.0
    for entry in account.get("landed_entries", []):
        if _remaining_principal(entry) > 0:
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
        "total_jewellery_weight": round(total_jewellery_weight, 2),
    }


# ============================================================================
# NEW sequential-per-entry payment processing
# ============================================================================

def _apply_payment_to_entry(entry: dict, amount: float, payment_date: datetime) -> tuple:
    """
    Apply `amount` to a single landed entry. Interest first, then principal.

    Mutates `entry` in place (updates remaining_principal, carried_forward_interest,
    interest_start_date).

    Returns: (interest_paid, principal_paid, remaining_interest_on_entry, leftover_amount)
    """
    if amount <= 0:
        return 0.0, 0.0, float(entry.get("carried_forward_interest", 0.0) or 0.0), 0.0

    if not _entry_existed_at_payment(entry, payment_date):
        # Cannot pay an entry that didn't yet exist; return full amount as leftover
        return 0.0, 0.0, float(entry.get("carried_forward_interest", 0.0) or 0.0), amount

    remaining_principal = _remaining_principal(entry)
    if remaining_principal <= 0:
        # Entry is fully paid; no interest accrues; nothing to settle here
        return 0.0, 0.0, 0.0, amount

    interest_due = get_total_interest_for_entry(entry, payment_date)
    interest_paid = min(amount, interest_due)
    amount_after_interest = amount - interest_paid

    # Always reset interest_start_date when ANY payment touches the entry — going
    # forward the entry recomputes interest from this date on its (possibly reduced)
    # remaining_principal.
    entry["interest_start_date"] = payment_date.isoformat()

    if interest_paid >= interest_due:
        # Interest fully cleared
        entry["carried_forward_interest"] = 0.0
        remaining_interest_on_entry = 0.0
    else:
        # Partial interest payment — carry the unpaid interest forward
        carry = round(interest_due - interest_paid, 2)
        entry["carried_forward_interest"] = carry
        remaining_interest_on_entry = carry

    # Apply remaining amount to principal
    principal_paid = min(amount_after_interest, remaining_principal)
    entry["remaining_principal"] = round(remaining_principal - principal_paid, 2)
    leftover = round(amount_after_interest - principal_paid, 2)

    return (
        round(interest_paid, 2),
        round(principal_paid, 2),
        remaining_interest_on_entry,
        leftover,
    )


def process_payment(
    landed_entries: List[dict],
    payment_amount: float,
    payment_date: datetime,
    allocations: Optional[List[dict]] = None,
):
    """
    Sequentially apply payment to landed entries.

    Args:
        landed_entries: list of landed entries (will be mutated in place)
        payment_amount: total receiving amount
        payment_date: payment date
        allocations: optional list of {landed_index, amount} for MANUAL mode.
                     If None or empty, FIFO order is used and `payment_amount`
                     is applied entry-by-entry until exhausted.

    Returns:
        (landed_entries, total_principal_paid, total_interest_paid,
         total_remaining_interest, per_entry_allocations)

    per_entry_allocations is a list of dicts each with:
        landed_index, landed_date, amount, interest_paid, principal_paid,
        remaining_interest_after.
    """
    total_principal = 0.0
    total_interest = 0.0
    per_entry = []

    if allocations:
        # MANUAL MODE
        for alloc in allocations:
            try:
                idx = int(alloc.get("landed_index"))
                amt = float(alloc.get("amount", 0) or 0)
            except (TypeError, ValueError):
                continue
            if idx < 0 or idx >= len(landed_entries) or amt <= 0:
                continue
            entry = landed_entries[idx]
            ip, pp, rem_int, leftover = _apply_payment_to_entry(entry, amt, payment_date)
            if ip > 0 or pp > 0:
                per_entry.append({
                    "landed_index": idx,
                    "landed_date": entry.get("date", ""),
                    "amount": round(ip + pp, 2),
                    "interest_paid": ip,
                    "principal_paid": pp,
                    "remaining_interest_after": rem_int,
                })
            total_principal += pp
            total_interest += ip
            # In manual mode any leftover within an entry's allocation is intentional —
            # caller chose to send more than this entry needed. We do NOT cascade it,
            # mirroring the user's intent.
    else:
        # FIFO MODE — sequential per entry, oldest first
        indexed = [
            (i, e) for i, e in enumerate(landed_entries)
            if _entry_existed_at_payment(e, payment_date)
        ]
        indexed.sort(key=lambda x: x[1].get("date", ""))

        remaining = float(payment_amount)
        for idx, entry in indexed:
            if remaining <= 0:
                break
            ip, pp, rem_int, leftover = _apply_payment_to_entry(entry, remaining, payment_date)
            if ip > 0 or pp > 0:
                per_entry.append({
                    "landed_index": idx,
                    "landed_date": entry.get("date", ""),
                    "amount": round(ip + pp, 2),
                    "interest_paid": ip,
                    "principal_paid": pp,
                    "remaining_interest_after": rem_int,
                })
            total_principal += pp
            total_interest += ip
            remaining = leftover

    total_remaining_interest = sum(
        float(e.get("carried_forward_interest", 0.0) or 0.0) for e in landed_entries
    )

    return (
        landed_entries,
        round(total_principal, 2),
        round(total_interest, 2),
        round(total_remaining_interest, 2),
        per_entry,
    )


# ============================================================================
# Ledger helpers
# ============================================================================

async def create_ledger_entry(account_id: str, transaction_type: str, amount: float,
                              principal_amount: float, interest_amount: float,
                              balance_amount: float, created_by: str, transaction_date: str = None,
                              remaining_interest: float = 0.0, remaining_principal: float = 0.0,
                              allocations: Optional[List[dict]] = None):
    if transaction_date:
        try:
            txn_date = datetime.fromisoformat(transaction_date)
            if txn_date.tzinfo is None:
                txn_date = txn_date.replace(tzinfo=timezone.utc)
        except Exception:
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
        "allocations": allocations or [],
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
    }
    await ledger_collection.insert_one(ledger_entry)


async def generate_chronological_ledger(account_id: str, landed_entries: list, received_entries: list, created_by: str):
    """Generate ledger entries in chronological order for a correct running balance."""
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
                remaining_interest=0.0, remaining_principal=running_balance,
            )
        else:
            running_balance -= float(entry.get("principal_paid", 0))
            await create_ledger_entry(
                account_id, "PAYMENT", entry["amount"],
                entry.get("principal_paid", 0), entry.get("interest_paid", 0),
                running_balance, created_by, entry["date"],
                remaining_interest=float(entry.get("remaining_interest", 0)),
                remaining_principal=running_balance,
                allocations=entry.get("allocations", []),
            )
