"""
Iteration 19 regression tests.

Bugs verified:
 1. /ledger-enhanced/{id} for ACC000011 reports new sequential per-entry FIFO
    (or stored manual allocations) instead of legacy proportional split.
 2. Backend regression: previous iter-18 contract still holds — opening_date
    lock, date validation, manual + fifo received entries with allocations,
    preview-payment endpoint.
"""
import os
import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fallback: read from frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for ln in f:
                    if ln.startswith("REACT_APP_BACKEND_URL="):
                        url = ln.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
ACC_ID = "6a4116c735cfdeef5d7fd7d6"  # ACC000011


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Bug 1: ledger-enhanced calculation ----------
class TestLedgerEnhancedCalc:
    @pytest.fixture(scope="class")
    def ledger(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/ledger-enhanced/{ACC_ID}", headers=h, timeout=20)
        assert r.status_code == 200, r.text
        return r.json()

    def test_payment_rows_exist(self, ledger):
        payments = [e for e in ledger["entries"] if e["transaction_type"] == "PAYMENT"]
        assert len(payments) == 2, f"expected 2 payments, got {len(payments)}"

    def test_payments_have_allocation_method(self, ledger):
        payments = [e for e in ledger["entries"] if e["transaction_type"] == "PAYMENT"]
        methods = sorted([p.get("allocation_method") for p in payments])
        assert methods == ["fifo", "manual"], f"got {methods}"

    def test_fifo_payment_10000(self, ledger):
        payments = [e for e in ledger["entries"] if e["transaction_type"] == "PAYMENT"]
        fifo = next(p for p in payments if p["allocation_method"] == "fifo")
        assert fifo["amount"] == 10000
        b = fifo["breakdown"]
        assert len(b) == 2
        # b[0] = 2026-02-01 entry
        assert b[0]["landed_date"].startswith("2026-02-01")
        assert b[0]["days"] == 147, f"days={b[0]['days']}"
        assert abs(b[0]["calculated_interest"] - 15312.5) < 0.05, b[0]
        assert abs(b[0]["interest_paid"] - 10000) < 0.05, b[0]
        assert abs(b[0]["principal_paid"] - 0) < 0.05, b[0]
        # b[1] = 2026-03-10 entry, untouched
        assert b[1]["landed_date"].startswith("2026-03-10")
        assert abs(b[1]["interest_paid"] - 0) < 0.05, b[1]
        assert abs(b[1]["principal_paid"] - 0) < 0.05, b[1]

    def test_manual_payment_5000(self, ledger):
        payments = [e for e in ledger["entries"] if e["transaction_type"] == "PAYMENT"]
        manual = next(p for p in payments if p["allocation_method"] == "manual")
        assert manual["amount"] == 5000
        b = manual["breakdown"]
        assert len(b) == 2
        # Acceptance: b[0] carried_forward = 5312.5, interest_paid=2000, principal_paid=0
        assert abs(b[0]["carried_forward"] - 5312.5) < 0.05, b[0]
        assert abs(b[0]["interest_paid"] - 2000) < 0.05, b[0]
        assert abs(b[0]["principal_paid"] - 0) < 0.05, b[0]
        # b[1]: calculated_interest ~2291.67, interest_paid 2291.67, principal_paid 708.33
        assert abs(b[1]["calculated_interest"] - 2291.67) < 0.5, b[1]
        assert abs(b[1]["interest_paid"] - 2291.67) < 0.5, b[1]
        assert abs(b[1]["principal_paid"] - 708.33) < 0.5, b[1]

    def test_no_legacy_proportional_values(self, ledger):
        # Old algorithm produced 8698.22 / 1301.78 / 4349.11 etc.
        bad = {8698.22, 1301.78, 4349.11, 650.89}
        payments = [e for e in ledger["entries"] if e["transaction_type"] == "PAYMENT"]
        for p in payments:
            for b in p["breakdown"]:
                for k in ("interest_paid", "principal_paid"):
                    assert round(b[k], 2) not in bad, f"legacy value {b[k]} found in {p}"


# ---------- Bug 2: Backend regression — iter18 contract still holds ----------
class TestIter18Regression:
    def test_opening_date_locked(self, auth):
        r = requests.get(f"{BASE_URL}/api/accounts/{ACC_ID}", headers=auth, timeout=20)
        assert r.status_code == 200
        acc = r.json()
        original_open = acc.get("opening_date")
        # PUT with changed opening_date should fail
        payload = {**acc, "opening_date": "2020-01-01"}
        # Strip non-editable computed fields if present
        for k in ("_id", "id", "created_at", "updated_at"):
            payload.pop(k, None)
        r2 = requests.put(
            f"{BASE_URL}/api/accounts/{ACC_ID}", headers=auth, json=payload, timeout=20
        )
        assert r2.status_code in (400, 422), f"expected reject, got {r2.status_code}: {r2.text}"
        # Confirm unchanged
        r3 = requests.get(f"{BASE_URL}/api/accounts/{ACC_ID}", headers=auth, timeout=20)
        assert r3.json().get("opening_date") == original_open

    def test_received_before_opening_rejected(self, auth):
        # opening_date is 2026-02-01 — try 2020-01-01
        payload = {"amount": 1, "date": "2020-01-01", "allocation_method": "fifo"}
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_ID}/received", headers=auth, json=payload, timeout=20
        )
        assert r.status_code == 400, f"got {r.status_code}: {r.text}"
        assert "Account Opening Date" in r.text or "earlier" in r.text.lower()

    def test_preview_payment_endpoint(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_ID}/payments/preview?payment_date=2026-06-28",
            headers=auth,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "entries" in data and len(data["entries"]) >= 2
        for e in data["entries"]:
            assert "landed_index" in e
            assert "interest_due" in e
            assert "outstanding" in e

    def test_preview_payment_before_opening_rejected(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_ID}/payments/preview?payment_date=2020-01-01",
            headers=auth,
            timeout=20,
        )
        assert r.status_code == 400

    def test_manual_validation_sum_mismatch(self, auth):
        # Sum (50) != amount (100)
        payload = {
            "amount": 100,
            "date": "2026-06-28",
            "allocation_method": "manual",
            "allocations": [{"landed_index": 0, "amount": 50}],
        }
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_ID}/received", headers=auth, json=payload, timeout=20
        )
        assert r.status_code == 400, f"got {r.status_code}: {r.text}"
