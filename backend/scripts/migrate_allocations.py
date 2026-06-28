"""
Iteration 18 migration — backfill per-landed allocations on existing received entries.

For every account:
  * Rebuilds landed_entries from their original `amount` (resets running state).
  * Replays received_entries in chronological order, applying each with the new
    per-entry sequential FIFO algorithm (allocation_method=fifo unless the entry
    already has manual allocations stored).
  * Stores the new `allocations` array + updated principal/interest paid on each
    received entry.
  * Regenerates the ledger.

Safe to re-run: idempotent. It always recomputes from `amount`/dates which are not
mutated.

Run:
    python /app/backend/scripts/migrate_allocations.py
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..")))

from config import accounts_collection, ledger_collection  # noqa: E402
from services.financial import process_payment, generate_chronological_ledger  # noqa: E402


async def migrate_account(doc: dict) -> dict:
    """Returns dict with stats about this account's migration."""
    landed_src = doc.get("landed_entries", []) or []
    received_src = doc.get("received_entries", []) or []

    # Reset landed running state, preserving immutable fields
    landed = []
    for le in landed_src:
        landed.append({
            "date": le.get("date"),
            "amount": float(le.get("amount", 0) or 0),
            "interest_rate": float(le.get("interest_rate", 2) or 2),
            "note": le.get("note", "") or "",
            "remaining_principal": float(le.get("amount", 0) or 0),
            "interest_start_date": le.get("date"),
            "carried_forward_interest": 0.0,
        })

    sorted_received = sorted(
        [r for r in received_src if isinstance(r, dict) and r.get("date") and r.get("amount") is not None],
        key=lambda x: x["date"]
    )

    new_received = []
    for r in sorted_received:
        payment_date = datetime.fromisoformat(r["date"])
        allocation_method = (r.get("allocation_method") or "fifo").lower()
        manual_allocations = r.get("allocations") if allocation_method == "manual" and r.get("allocations") else None
        # Filter out server-side computed fields (interest_paid, principal_paid, etc.)
        # from old manual allocations to only keep landed_index + amount.
        if manual_allocations:
            manual_allocations = [
                {"landed_index": a.get("landed_index"), "amount": a.get("amount", a.get("interest_paid", 0) + a.get("principal_paid", 0))}
                for a in manual_allocations
                if a.get("landed_index") is not None
            ]
        landed, p_paid, i_paid, rem_int, per_entry = process_payment(
            landed, float(r["amount"]), payment_date, allocations=manual_allocations
        )
        new_received.append({
            "date": r["date"],
            "amount": float(r["amount"]),
            "note": r.get("note", "") or "",
            "principal_paid": p_paid,
            "interest_paid": i_paid,
            "remaining_interest": rem_int,
            "allocation_method": allocation_method,
            "allocations": per_entry,
        })

    # Persist
    await accounts_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "landed_entries": landed,
            "received_entries": new_received,
            "_migration_iter18": True,
            "_migration_iter18_at": datetime.now(timezone.utc),
        }}
    )

    # Regenerate ledger
    account_id = str(doc["_id"])
    await ledger_collection.delete_many({"account_id": account_id})
    await generate_chronological_ledger(account_id, landed, new_received, doc.get("created_by", "migration"))

    return {
        "account_number": doc.get("account_number"),
        "landed_count": len(landed),
        "received_count": len(new_received),
    }


async def main():
    print("Iteration 18 — migrating per-entry allocations…")
    count = await accounts_collection.count_documents({})
    print(f"Found {count} accounts.")
    migrated = 0
    async for doc in accounts_collection.find({}):
        try:
            stats = await migrate_account(doc)
            migrated += 1
            print(f"  ✓ {stats['account_number']}: {stats['landed_count']} landed, {stats['received_count']} received")
        except Exception as e:
            print(f"  ✗ {doc.get('account_number')}: ERROR {e}")
    print(f"Done. Migrated {migrated}/{count} accounts.")


if __name__ == "__main__":
    asyncio.run(main())
