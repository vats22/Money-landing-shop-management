"""
Iteration 16: Notes (rich-text) field persistence + regression of partial update bug
that was previously corrupting landed_entries.remaining_principal.

Covers:
- Login (admin)
- POST /api/accounts with notes in landed/received entries
- GET /api/accounts/{id} returns notes
- PUT /api/accounts/{id} full payload preserves & updates notes
- PUT /api/accounts/{id} partial (only village) MUST NOT corrupt remaining_principal
- GET /api/ledger-enhanced/{id} exposes user_note + breakdown.interest_start_date
- POST /api/accounts/{id}/landed (and /received) persist note
- PUT /api/accounts/{id} status=closed adds close_history
- Regression: accounts list filters, dashboard stats, ledger, reopen, villages
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://web-showcase-217.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# -------- Fixtures --------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_account(headers):
    """Create a TEST_ account with notes on landed and received entries."""
    payload = {
        "opening_date": "2025-01-01",
        "name": "TEST_Iteration16",
        "village": "TestVillage",
        "status": "continue",
        "details": "iteration16 e2e",
        "jewellery_items": [{"name": "Gold Ring", "weight": 5.5}],
        "landed_entries": [
            {"date": "2025-01-01", "amount": 10000, "interest_rate": 2,
             "note": "<p>Initial loan <strong>note</strong></p>"}
        ],
        "received_entries": [
            {"date": "2025-02-01", "amount": 2000,
             "note": "<p>Partial payment <em>note</em></p>"}
        ],
    }
    r = requests.post(f"{API}/accounts", json=payload, headers=headers, timeout=30)
    assert r.status_code == 201, f"create failed: {r.status_code} {r.text}"
    data = r.json()
    yield data
    # teardown
    try:
        requests.delete(f"{API}/accounts/{data['id']}", headers=headers, timeout=20)
    except Exception:
        pass


# -------- Auth --------

def test_login_admin_success():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "token" in body and isinstance(body["token"], str)
    assert body["user"]["username"] == ADMIN_USER


def test_login_invalid_credentials():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": "wrong"}, timeout=20)
    assert r.status_code == 401


# -------- Notes persistence (create + GET) --------

def test_create_account_notes_persisted_on_create_response(created_account):
    landed = created_account["landed_entries"]
    received = created_account["received_entries"]
    assert landed[0].get("note") == "<p>Initial loan <strong>note</strong></p>"
    assert received[0].get("note") == "<p>Partial payment <em>note</em></p>"


def test_get_account_returns_notes(created_account, headers):
    r = requests.get(f"{API}/accounts/{created_account['id']}", headers=headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["landed_entries"][0]["note"] == "<p>Initial loan <strong>note</strong></p>"
    assert data["received_entries"][0]["note"] == "<p>Partial payment <em>note</em></p>"


# -------- Add-entry endpoints persist note --------

def test_add_landed_entry_persists_note(created_account, headers):
    aid = created_account["id"]
    payload = {"date": "2025-03-01", "amount": 5000, "interest_rate": 2,
               "note": "<p>Second landed</p>"}
    r = requests.post(f"{API}/accounts/{aid}/landed", json=payload, headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/accounts/{aid}", headers=headers, timeout=20).json()
    notes = [e.get("note") for e in g["landed_entries"]]
    assert "<p>Second landed</p>" in notes


def test_add_received_entry_persists_note(created_account, headers):
    aid = created_account["id"]
    payload = {"date": "2025-04-01", "amount": 1000, "note": "<p>Second payment</p>"}
    r = requests.post(f"{API}/accounts/{aid}/received", json=payload, headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/accounts/{aid}", headers=headers, timeout=20).json()
    notes = [e.get("note") for e in g["received_entries"]]
    assert "<p>Second payment</p>" in notes


# -------- PUT full payload preserves & updates notes --------

def test_put_full_payload_updates_notes(created_account, headers):
    aid = created_account["id"]
    g = requests.get(f"{API}/accounts/{aid}", headers=headers, timeout=20).json()
    landed = [{"date": e["date"], "amount": e["amount"], "interest_rate": e.get("interest_rate", 2),
               "note": e.get("note", "")} for e in g["landed_entries"]]
    received = [{"date": e["date"], "amount": e["amount"], "note": e.get("note", "")}
                for e in g["received_entries"]]
    landed[0]["note"] = "<p>UPDATED initial</p>"
    payload = {
        "opening_date": g["opening_date"], "name": g["name"], "village": g["village"],
        "status": g["status"], "details": g.get("details", ""),
        "jewellery_items": g.get("jewellery_items", []),
        "landed_entries": landed, "received_entries": received,
    }
    r = requests.put(f"{API}/accounts/{aid}", json=payload, headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    g2 = requests.get(f"{API}/accounts/{aid}", headers=headers, timeout=20).json()
    assert g2["landed_entries"][0]["note"] == "<p>UPDATED initial</p>"
    # Other notes preserved
    other_notes = [e.get("note") for e in g2["landed_entries"][1:]] + [e.get("note") for e in g2["received_entries"]]
    assert "<p>Second landed</p>" in other_notes
    assert "<p>Partial payment <em>note</em></p>" in other_notes


# -------- Regression: partial update must NOT corrupt remaining_principal --------

def test_partial_update_preserves_remaining_principal(headers):
    """Create account, pay it off fully, PUT with only {village}: pending must stay 0."""
    create_payload = {
        "opening_date": "2025-01-01", "name": "TEST_PaidOff", "village": "OldVillage",
        "status": "continue",
        # same date for landed + received => 0 days => 0 interest => fully paid
        "landed_entries": [{"date": "2025-01-01", "amount": 1000, "interest_rate": 2, "note": ""}],
        "received_entries": [{"date": "2025-01-01", "amount": 1000, "note": ""}],
    }
    r = requests.post(f"{API}/accounts", json=create_payload, headers=headers, timeout=30)
    assert r.status_code == 201, r.text
    aid = r.json()["id"]
    try:
        g = requests.get(f"{API}/accounts/{aid}", headers=headers, timeout=20).json()
        assert g["total_pending_amount"] == 0, f"baseline pending != 0: {g['total_pending_amount']}"

        # Partial update: only village
        u = requests.put(f"{API}/accounts/{aid}", json={"village": "NewVillage"}, headers=headers, timeout=20)
        assert u.status_code == 200, u.text

        g2 = requests.get(f"{API}/accounts/{aid}", headers=headers, timeout=20).json()
        assert g2["village"] == "NewVillage"
        assert g2["total_pending_amount"] == 0, (
            f"REGRESSION: pending should remain 0 after partial update, got {g2['total_pending_amount']}"
        )
        # remaining_principal in landed entry stays 0
        assert float(g2["landed_entries"][0].get("remaining_principal", -1)) == 0.0
    finally:
        requests.delete(f"{API}/accounts/{aid}", headers=headers, timeout=20)


# -------- Enhanced ledger: user_note + interest_start_date in breakdown --------

def test_enhanced_ledger_user_note_and_interest_start_date(created_account, headers):
    aid = created_account["id"]
    r = requests.get(f"{API}/ledger-enhanced/{aid}", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    entries = data.get("entries", [])
    assert len(entries) > 0
    landed_rows = [e for e in entries if e["transaction_type"] == "LANDED"]
    payment_rows = [e for e in entries if e["transaction_type"] == "PAYMENT"]
    assert landed_rows, "no LANDED rows"
    assert payment_rows, "no PAYMENT rows"
    # user_note present (string field) on both row types
    for row in landed_rows + payment_rows:
        assert "user_note" in row, f"user_note missing in {row['transaction_type']} row"
    # at least one row carries a user note (the test_put_full_payload_updates_notes
    # may have updated the original note text — we just verify any non-empty propagation)
    user_notes = [r["user_note"] for r in landed_rows + payment_rows]
    assert any(n for n in user_notes), f"no user_note propagated: {user_notes}"
    # interest_start_date in breakdown items
    for row in landed_rows + payment_rows:
        for b in row.get("breakdown", []):
            assert "interest_start_date" in b, f"breakdown missing interest_start_date: {b}"


# -------- Status -> closed via PUT adds close_history --------

def test_put_status_closed_adds_close_history(headers):
    payload = {
        "opening_date": "2025-01-01", "name": "TEST_CloseViaPut", "village": "V",
        "status": "continue",
        "landed_entries": [{"date": "2025-01-01", "amount": 500, "interest_rate": 2}],
        "received_entries": [],
    }
    r = requests.post(f"{API}/accounts", json=payload, headers=headers, timeout=30)
    assert r.status_code == 201
    aid = r.json()["id"]
    try:
        u = requests.put(f"{API}/accounts/{aid}", json={"status": "closed"}, headers=headers, timeout=20)
        assert u.status_code == 200, u.text
        body = u.json()
        assert body["status"] == "closed"
        assert isinstance(body.get("close_history"), list) and len(body["close_history"]) >= 1
        ce = body["close_history"][-1]
        assert "final_pending_amount" in ce and "final_pending_interest" in ce
        assert "closed_at" in ce
    finally:
        # reopen + delete (admin has unlock perm)
        requests.post(f"{API}/accounts/{aid}/reopen",
                      json={"reason": "cleanup"}, headers=headers, timeout=20)
        requests.delete(f"{API}/accounts/{aid}", headers=headers, timeout=20)


# -------- Regression: list, filters, dashboard, ledger, reopen, villages --------

def test_accounts_list_with_filters(headers):
    r = requests.get(f"{API}/accounts?page=1&limit=5&status=continue", headers=headers, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "accounts" in body and "total" in body and "total_pages" in body


def test_dashboard_stats(headers):
    r = requests.get(f"{API}/dashboard/stats", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    # basic shape
    assert isinstance(body, dict)


def test_ledger_endpoint(created_account, headers):
    r = requests.get(f"{API}/ledger/{created_account['id']}", headers=headers, timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_villages_endpoint(headers):
    r = requests.get(f"{API}/villages", headers=headers, timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_close_then_reopen_endpoint(headers):
    payload = {
        "opening_date": "2025-01-01", "name": "TEST_CloseEndpoint", "village": "V",
        "status": "continue",
        "landed_entries": [{"date": "2025-01-01", "amount": 100, "interest_rate": 2}],
    }
    r = requests.post(f"{API}/accounts", json=payload, headers=headers, timeout=30)
    aid = r.json()["id"]
    try:
        c = requests.post(f"{API}/accounts/{aid}/close",
                          json={"close_date": "2025-06-01", "remarks": "test close"},
                          headers=headers, timeout=20)
        assert c.status_code == 200, c.text
        ro = requests.post(f"{API}/accounts/{aid}/reopen",
                           json={"reason": "regression test"}, headers=headers, timeout=20)
        assert ro.status_code == 200, ro.text
        g = requests.get(f"{API}/accounts/{aid}", headers=headers, timeout=20).json()
        assert g["status"] == "continue"
    finally:
        requests.delete(f"{API}/accounts/{aid}", headers=headers, timeout=20)
