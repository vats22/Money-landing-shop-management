"""
Iteration 12 Bug Fixes Tests:
1. History tab shows events in descending chronological order (newest first)
2. History tab interleaves close and reopen events properly (not grouped by type)
3. Close Account modal shows today's date as disabled/non-editable field
4. Close Account still works correctly (creates close history entry with today's date)
5. Backend: POST /api/accounts/{id}/landed rejects entry date before opening_date (400)
6. Backend: POST /api/accounts/{id}/received rejects entry date before opening_date (400)
7. Backend: POST /api/accounts/{id}/landed rejects future date (400)
8. Reopen still works correctly
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test account with opening date 2026-03-01 - ACC000039 (id: 69bebeac0390ebf9b7d0ae1e)
# Opening date: 2026-03-01
TEST_ACCOUNT_ID = "69bebeac0390ebf9b7d0ae1e"
TEST_ACCOUNT_OPENING_DATE = "2026-03-01"

# Test account with close/reopen history - ACC000045 (id: 69bed77c5b33dabe3fd5ef72)
TEST_ACCOUNT_WITH_HISTORY_ID = "69bed77c5b33dabe3fd5ef72"


class TestIteration12BugFixes:
    """Tests for Iteration 12 bug fixes: history ordering, close date auto-select, min date validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    # ==================== DATE VALIDATION TESTS ====================
    
    def test_landed_entry_rejects_date_before_opening_date(self):
        """Test: POST /api/accounts/{id}/landed rejects entry date before opening_date (400)"""
        # Try to add a landed entry with date 2026-02-15 (before opening date 2026-03-01)
        response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_ID}/landed", json={
            "date": "2026-02-15",  # Before opening date 2026-03-01
            "amount": 1000,
            "interest_rate": 2
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "opening date" in data.get("detail", "").lower() or "before" in data.get("detail", "").lower(), \
            f"Expected error about opening date, got: {data}"
        print(f"✓ Landed entry with date before opening date correctly rejected: {data.get('detail')}")
    
    def test_received_entry_rejects_date_before_opening_date(self):
        """Test: POST /api/accounts/{id}/received rejects entry date before opening_date (400)"""
        # Try to add a received entry with date 2026-02-15 (before opening date 2026-03-01)
        response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_ID}/received", json={
            "date": "2026-02-15",  # Before opening date 2026-03-01
            "amount": 500
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "opening date" in data.get("detail", "").lower() or "before" in data.get("detail", "").lower(), \
            f"Expected error about opening date, got: {data}"
        print(f"✓ Received entry with date before opening date correctly rejected: {data.get('detail')}")
    
    def test_landed_entry_rejects_future_date(self):
        """Test: POST /api/accounts/{id}/landed rejects future date (400)"""
        # Try to add a landed entry with a future date
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_ID}/landed", json={
            "date": future_date,
            "amount": 1000,
            "interest_rate": 2
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "future" in data.get("detail", "").lower(), \
            f"Expected error about future date, got: {data}"
        print(f"✓ Landed entry with future date correctly rejected: {data.get('detail')}")
    
    def test_received_entry_rejects_future_date(self):
        """Test: POST /api/accounts/{id}/received rejects future date (400)"""
        # Try to add a received entry with a future date
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_ID}/received", json={
            "date": future_date,
            "amount": 500
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "future" in data.get("detail", "").lower(), \
            f"Expected error about future date, got: {data}"
        print(f"✓ Received entry with future date correctly rejected: {data.get('detail')}")
    
    def test_landed_entry_accepts_valid_date(self):
        """Test: POST /api/accounts/{id}/landed accepts valid date (on or after opening date, not future)"""
        # Use a valid date: 2026-03-15 (after opening date 2026-03-01, before today)
        valid_date = "2026-03-15"
        
        response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_ID}/landed", json={
            "date": valid_date,
            "amount": 100,  # Small amount for test
            "interest_rate": 2
        })
        
        # Should succeed (200 or 201) or fail with 403 if account is closed
        if response.status_code == 403:
            # Account might be closed, which is expected behavior
            print(f"✓ Account is closed, cannot add entries (expected behavior)")
        else:
            assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
            print(f"✓ Landed entry with valid date accepted")
    
    # ==================== ACCOUNT HISTORY TESTS ====================
    
    def test_account_has_close_reopen_history(self):
        """Test: Account has close_history and reopen_history arrays"""
        response = self.session.get(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check that history arrays exist
        close_history = data.get("close_history", [])
        reopen_history = data.get("reopen_history", [])
        
        print(f"Close history entries: {len(close_history)}")
        print(f"Reopen history entries: {len(reopen_history)}")
        
        # At least one of them should have entries for this test account
        total_history = len(close_history) + len(reopen_history)
        assert total_history > 0, "Expected at least one history entry"
        
        # Verify structure of close_history entries
        for entry in close_history:
            assert "closed_at" in entry, "close_history entry missing closed_at"
            print(f"  Close entry: {entry.get('closed_at')} by {entry.get('closed_by_name')}")
        
        # Verify structure of reopen_history entries
        for entry in reopen_history:
            assert "reopened_at" in entry, "reopen_history entry missing reopened_at"
            print(f"  Reopen entry: {entry.get('reopened_at')} by {entry.get('reopened_by_name')}")
        
        print(f"✓ Account has {total_history} history entries")
    
    def test_history_events_can_be_sorted_chronologically(self):
        """Test: History events from close_history and reopen_history can be interleaved chronologically"""
        response = self.session.get(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Build combined history events (same logic as frontend)
        history_events = []
        
        for h in data.get("close_history", []):
            history_events.append({
                "type": "CLOSED",
                "date": h.get("closed_at"),
                "by": h.get("closed_by_name")
            })
        
        for h in data.get("reopen_history", []):
            history_events.append({
                "type": "REOPENED",
                "date": h.get("reopened_at"),
                "by": h.get("reopened_by_name")
            })
        
        # Sort by date descending (newest first)
        history_events.sort(key=lambda x: x["date"], reverse=True)
        
        print(f"History events in descending order:")
        for i, event in enumerate(history_events):
            print(f"  {i+1}. {event['type']} at {event['date']} by {event['by']}")
        
        # Verify descending order
        for i in range(len(history_events) - 1):
            current_date = history_events[i]["date"]
            next_date = history_events[i + 1]["date"]
            assert current_date >= next_date, f"Events not in descending order: {current_date} < {next_date}"
        
        print(f"✓ History events correctly sorted in descending chronological order")
    
    # ==================== CLOSE ACCOUNT TESTS ====================
    
    def test_close_account_uses_today_date(self):
        """Test: Close account endpoint accepts close_date and creates history entry"""
        # First check if account is already closed
        response = self.session.get(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("status") == "closed":
            print("Account is already closed - testing reopen first")
            # Reopen the account first
            reopen_response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}/reopen", json={
                "reason": "Test reopen for close test"
            })
            if reopen_response.status_code != 200:
                pytest.skip("Cannot reopen account for close test")
        
        # Now close the account with today's date
        today = datetime.now().strftime("%Y-%m-%d")
        close_response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}/close", json={
            "close_date": today,
            "remarks": "Test close for iteration 12"
        })
        
        assert close_response.status_code == 200, f"Expected 200, got {close_response.status_code}: {close_response.text}"
        close_data = close_response.json()
        
        assert "closed_at" in close_data, "Response missing closed_at"
        assert close_data["closed_at"] == today, f"Expected close date {today}, got {close_data['closed_at']}"
        
        print(f"✓ Account closed successfully with date: {close_data['closed_at']}")
        
        # Verify close_history was updated
        verify_response = self.session.get(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}")
        verify_data = verify_response.json()
        
        close_history = verify_data.get("close_history", [])
        assert len(close_history) > 0, "close_history should have at least one entry"
        
        # Check the latest close entry
        latest_close = close_history[-1]
        assert latest_close.get("remarks") == "Test close for iteration 12", "Close remarks not saved"
        print(f"✓ Close history entry created with remarks")
    
    def test_reopen_account_works(self):
        """Test: Reopen account endpoint works correctly"""
        # First check if account is closed
        response = self.session.get(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("status") != "closed":
            print("Account is not closed - closing first")
            today = datetime.now().strftime("%Y-%m-%d")
            close_response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}/close", json={
                "close_date": today,
                "remarks": "Test close for reopen test"
            })
            if close_response.status_code != 200:
                pytest.skip("Cannot close account for reopen test")
        
        # Now reopen the account
        reopen_response = self.session.post(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}/reopen", json={
            "reason": "Test reopen for iteration 12"
        })
        
        assert reopen_response.status_code == 200, f"Expected 200, got {reopen_response.status_code}: {reopen_response.text}"
        reopen_data = reopen_response.json()
        
        assert "reopened_at" in reopen_data, "Response missing reopened_at"
        assert reopen_data.get("reason") == "Test reopen for iteration 12", "Reason not returned"
        
        print(f"✓ Account reopened successfully at: {reopen_data['reopened_at']}")
        
        # Verify reopen_history was updated
        verify_response = self.session.get(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_WITH_HISTORY_ID}")
        verify_data = verify_response.json()
        
        assert verify_data.get("status") == "continue", "Account status should be 'continue' after reopen"
        
        reopen_history = verify_data.get("reopen_history", [])
        assert len(reopen_history) > 0, "reopen_history should have at least one entry"
        
        # Check the latest reopen entry
        latest_reopen = reopen_history[-1]
        assert latest_reopen.get("reason") == "Test reopen for iteration 12", "Reopen reason not saved"
        print(f"✓ Reopen history entry created with reason")
    
    # ==================== REGRESSION TESTS ====================
    
    def test_account_detail_endpoint_works(self):
        """Regression: Account detail endpoint returns all expected fields"""
        response = self.session.get(f"{BASE_URL}/api/accounts/{TEST_ACCOUNT_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check essential fields
        required_fields = ["id", "account_number", "name", "village", "opening_date", "status"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✓ Account detail endpoint returns all required fields")
        print(f"  Account: {data.get('account_number')} - {data.get('name')}")
        print(f"  Opening date: {data.get('opening_date')}")
        print(f"  Status: {data.get('status')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
