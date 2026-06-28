"""
Iteration 18 backend tests
- Date validation against opening_date (create / update / received)
- Reject opening_date changes on update
- Sequential per-entry FIFO allocation
- Manual allocations + validation
- Payment preview endpoint
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"username": "admin", "password": "admin123"}
ACC_MULTI_ID = "6a3691297e4c7d2ddc6dcc57"  # ACC000005 — 2 landed entries
ACC_IMAGE_ID = "6a3691297e4c7d2ddc6dcc60"  # ACC000007


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# -------- BUG #3: Opening date locked / date validation --------

class TestOpeningDateLocked:
    def test_reject_opening_date_change(self, auth):
        r = requests.put(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}",
            json={"opening_date": "2020-01-01"},
            headers=auth, timeout=15
        )
        assert r.status_code == 400, r.text
        assert "Opening Date cannot be changed" in r.json().get("detail", "")

    def test_reject_received_before_opening(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/received",
            json={"date": "2020-01-01", "amount": 100},
            headers=auth, timeout=15
        )
        assert r.status_code == 400, r.text
        assert "earlier than the Account Opening Date" in r.json().get("detail", "")

    def test_reject_landed_before_opening(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/landed",
            json={"date": "2020-01-01", "amount": 100, "interest_rate": 2},
            headers=auth, timeout=15
        )
        assert r.status_code == 400, r.text
        assert "earlier than the Account Opening Date" in r.json().get("detail", "")


# -------- BUG #4: Payments / Allocations --------

class TestPaymentsAndAllocations:
    def test_preview_returns_per_entry(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/payments/preview"
            f"?payment_date=2026-06-21",
            headers=auth, timeout=15
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "entries" in data and isinstance(data["entries"], list)
        assert "total_outstanding" in data
        assert "total_interest_due" in data
        if data["entries"]:
            e = data["entries"][0]
            for k in ("landed_index", "interest_due", "outstanding", "landed_date"):
                assert k in e, f"missing {k} in preview entry"

    def test_preview_rejects_before_opening(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/payments/preview"
            f"?payment_date=2020-01-01",
            headers=auth, timeout=15
        )
        assert r.status_code == 400

    def test_account_has_allocation_fields(self, auth):
        r = requests.get(f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}", headers=auth, timeout=15)
        assert r.status_code == 200
        data = r.json()
        recvs = data.get("received_entries", []) or []
        # post-migration every received entry must have these
        for re in recvs:
            assert "allocation_method" in re, f"missing allocation_method: {re}"
            assert re["allocation_method"] in ("fifo", "manual")
            assert "allocations" in re

    def test_manual_validation_sum_mismatch(self, auth):
        # Total != amount
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/received",
            json={
                "date": "2026-06-21",
                "amount": 1000,
                "allocation_method": "manual",
                "allocations": [{"landed_index": 0, "amount": 500}],
            },
            headers=auth, timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "must equal" in r.json().get("detail", "").lower() or "allocated" in r.json().get("detail", "").lower()

    def test_manual_validation_exceeds_outstanding(self, auth):
        # Get an extremely high allocation that exceeds the entry's outstanding
        prev = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/payments/preview"
            f"?payment_date=2026-06-21",
            headers=auth, timeout=15
        ).json()
        if not prev.get("entries"):
            pytest.skip("No active entries to test against")
        target = prev["entries"][0]
        huge = target["outstanding"] + 100000
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/received",
            json={
                "date": "2026-06-21",
                "amount": huge,
                "allocation_method": "manual",
                "allocations": [{"landed_index": target["landed_index"], "amount": huge}],
            },
            headers=auth, timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "exceeds" in r.json().get("detail", "").lower()

    def test_manual_validation_empty_allocations(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}/received",
            json={
                "date": "2026-06-21",
                "amount": 100,
                "allocation_method": "manual",
                "allocations": [],
            },
            headers=auth, timeout=15,
        )
        assert r.status_code == 400


class TestFifoAllocation:
    """Verify migration replayed entries correctly with sequential FIFO."""

    def test_fifo_sequential_per_entry(self, auth):
        r = requests.get(f"{BASE_URL}/api/accounts/{ACC_MULTI_ID}", headers=auth, timeout=15)
        assert r.status_code == 200
        data = r.json()
        landed = data.get("landed_entries", [])
        recvs = data.get("received_entries", [])
        if not recvs:
            pytest.skip("No received entries on account")

        # find any FIFO entry and verify allocation breakdown matches I+P arithmetic
        fifo_entries = [re for re in recvs if re.get("allocation_method") == "fifo"]
        if not fifo_entries:
            pytest.skip("No FIFO entries to check (only manual exist)")

        for fe in fifo_entries:
            allocs = fe.get("allocations") or []
            if not allocs:
                continue
            sum_alloc = round(sum(a.get("amount", 0) for a in allocs), 2)
            sum_ip = round(sum(a.get("interest_paid", 0) + a.get("principal_paid", 0) for a in allocs), 2)
            assert abs(sum_alloc - sum_ip) < 0.05, f"alloc amount != I+P: {fe}"
            total_ip = round(fe.get("interest_paid", 0) + fe.get("principal_paid", 0), 2)
            assert abs(sum_alloc - total_ip) < 0.05, (
                f"allocations sum {sum_alloc} != entry totals {total_ip}"
            )

        assert isinstance(landed, list)
