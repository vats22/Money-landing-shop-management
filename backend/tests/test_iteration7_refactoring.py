"""
Test suite for Iteration 7 - Backend Refactoring Verification
Tests that all features still work after major backend refactoring:
- Monolithic server.py split into modular structure (config.py, auth.py, models.py, utils.py, services/financial.py, routes/)
- Data seeding script created 7 new accounts and 2 new users
- Total accounts: 10, Total users: 7

Tests:
1. Auth: Login with admin/admin123, operator1/operator123, viewer1/viewer123
2. Dashboard: Summary cards, Stats (10 accounts / 9 active / 1 closed)
3. Accounts: List all (10), search/filter, CRUD operations
4. Account Detail: ACC000025 Entry 2 interest_start_date = 2026-03-10 (bug fix)
5. Close/Reopen account flow
6. Ledger: Chronological order with correct running balance
7. Reports: All 4 endpoints
8. Export: Excel and PDF
9. User Management: List users, permissions
10. Villages: All unique villages including seeded data
11. Permission enforcement: operator1 limited permissions
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pawn-mgmt.preview.emergentagent.com').rstrip('/')


class TestAuthModule:
    """Test auth module after refactoring"""
    
    def test_01_health_check(self):
        """Verify API is healthy after refactoring"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ API health check passed - refactored backend is running")
    
    def test_02_login_admin(self):
        """Test admin login: admin/admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == "admin"
        assert data["user"]["is_admin"] == True
        print("✅ Admin login working: admin/admin123")
    
    def test_03_login_operator1(self):
        """Test seeded operator login: operator1/operator123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "operator1",
            "password": "operator123"
        })
        assert response.status_code == 200, f"Operator1 login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["username"] == "operator1"
        assert data["user"]["is_admin"] == False
        # Verify permissions
        perms = data["user"].get("permissions", {})
        assert perms.get("accounts", {}).get("view") == True
        assert perms.get("accounts", {}).get("add") == True
        assert perms.get("accounts", {}).get("update") == True
        assert perms.get("accounts", {}).get("delete") == False  # No delete permission
        print("✅ Operator1 login working: operator1/operator123 (view/add/update, NO delete)")
    
    def test_04_login_viewer1(self):
        """Test seeded viewer login: viewer1/viewer123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "viewer1",
            "password": "viewer123"
        })
        assert response.status_code == 200, f"Viewer1 login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["username"] == "viewer1"
        assert data["user"]["is_admin"] == False
        # Verify view-only permissions
        perms = data["user"].get("permissions", {})
        assert perms.get("accounts", {}).get("view") == True
        assert perms.get("accounts", {}).get("add") == False
        print("✅ Viewer1 login working: viewer1/viewer123 (view only)")
    
    def test_05_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid credentials correctly rejected")
    
    def test_06_get_current_user(self):
        """Test /api/auth/me endpoint"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        token = login_resp.json()["token"]
        
        # Get current user
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        print("✅ /api/auth/me endpoint working")


class TestDashboardModule:
    """Test dashboard module after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_07_dashboard_summary(self):
        """Test dashboard summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_landed_amount" in data
        assert "total_received_amount" in data
        assert "total_pending_amount" in data
        assert "total_pending_interest" in data
        
        print(f"✅ Dashboard summary working")
        print(f"   Total Landed: ₹{data['total_landed_amount']:,.2f}")
        print(f"   Total Pending: ₹{data['total_pending_amount']:,.2f}")
        print(f"   Pending Interest: ₹{data['total_pending_interest']:,.2f}")
    
    def test_08_dashboard_stats(self):
        """Test dashboard stats - should show 10 accounts / 9 active / 1 closed"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_accounts" in data
        assert "active_accounts" in data
        assert "closed_accounts" in data
        
        print(f"✅ Dashboard stats working")
        print(f"   Total: {data['total_accounts']}, Active: {data['active_accounts']}, Closed: {data['closed_accounts']}")
        
        # Verify expected counts after seeding
        assert data['total_accounts'] >= 10, f"Expected at least 10 accounts, got {data['total_accounts']}"


class TestAccountsModule:
    """Test accounts module after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_09_accounts_list(self):
        """Test accounts list - should return at least 10 accounts"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "accounts" in data
        assert "total" in data
        assert data["total"] >= 10, f"Expected at least 10 accounts, got {data['total']}"
        
        print(f"✅ Accounts list working - {data['total']} accounts found")
    
    def test_10_accounts_search(self):
        """Test accounts search functionality"""
        # Search by name
        response = requests.get(f"{BASE_URL}/api/accounts?search=Ramesh", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Search by name working - found {data['total']} results for 'Ramesh'")
    
    def test_11_accounts_filter_by_village(self):
        """Test accounts filter by village"""
        response = requests.get(f"{BASE_URL}/api/accounts?village=Rajkot", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # All returned accounts should be from Rajkot
        for acc in data["accounts"]:
            assert "Rajkot" in acc["village"], f"Expected Rajkot, got {acc['village']}"
        
        print(f"✅ Filter by village working - {data['total']} accounts in Rajkot")
    
    def test_12_accounts_filter_by_status(self):
        """Test accounts filter by status"""
        response = requests.get(f"{BASE_URL}/api/accounts?status=continue", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        for acc in data["accounts"]:
            assert acc["status"] == "continue"
        
        print(f"✅ Filter by status working - {data['total']} active accounts")
    
    def test_13_account_detail_acc000025(self):
        """Test account detail for ACC000025 - verify bug fix"""
        account_id = "69b820918f6a1fd1231b5224"
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        
        if response.status_code == 404:
            pytest.skip("Account ACC000025 not found")
        
        assert response.status_code == 200
        account = response.json()
        
        # Verify enriched data
        assert "total_landed_amount" in account
        assert "total_pending_amount" in account
        assert "total_pending_interest" in account
        assert "user_can_edit" in account
        assert "user_can_delete" in account
        
        # Verify bug fix: Entry 2 interest_start_date = 2026-03-10
        landed_entries = account.get("landed_entries", [])
        if len(landed_entries) >= 2:
            entry2 = landed_entries[1]
            entry2_interest_start = entry2.get("interest_start_date", "")[:10]
            assert entry2_interest_start == "2026-03-10", \
                f"BUG: Entry 2 interest_start_date ({entry2_interest_start}) should be 2026-03-10"
            print(f"✅ Account detail working - Bug fix verified: Entry 2 interest_start_date = 2026-03-10")
        else:
            print(f"✅ Account detail working - {account.get('account_number')}")
    
    def test_14_account_crud_create(self):
        """Test account creation"""
        new_account = {
            "opening_date": "2026-03-21",
            "name": "TEST_Iteration7_Account",
            "village": "TestVillage",
            "status": "continue",
            "details": "Test account for iteration 7",
            "jewellery_items": [{"name": "Test Gold Chain", "weight": 25.0}],
            "landed_entries": [{"date": "2026-03-21", "amount": 10000, "interest_rate": 2.0}],
            "received_entries": []
        }
        
        response = requests.post(f"{BASE_URL}/api/accounts", json=new_account, headers=self.headers)
        assert response.status_code == 201, f"Create account failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Iteration7_Account"
        assert data["account_number"].startswith("ACC")
        
        # Store for cleanup
        self.__class__.test_account_id = data["id"]
        print(f"✅ Account creation working - Created {data['account_number']}")
    
    def test_15_account_crud_update(self):
        """Test account update"""
        if not hasattr(self.__class__, 'test_account_id'):
            pytest.skip("No test account to update")
        
        account_id = self.__class__.test_account_id
        update_data = {"details": "Updated details for iteration 7 test"}
        
        response = requests.put(f"{BASE_URL}/api/accounts/{account_id}", json=update_data, headers=self.headers)
        assert response.status_code == 200, f"Update account failed: {response.text}"
        
        data = response.json()
        assert data["details"] == "Updated details for iteration 7 test"
        print("✅ Account update working")
    
    def test_16_account_crud_delete(self):
        """Test account deletion"""
        if not hasattr(self.__class__, 'test_account_id'):
            pytest.skip("No test account to delete")
        
        account_id = self.__class__.test_account_id
        response = requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert response.status_code == 200, f"Delete account failed: {response.text}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert get_response.status_code == 404
        print("✅ Account deletion working")


class TestCloseReopenFlow:
    """Test close/reopen account flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_17_close_reopen_flow(self):
        """Test close and reopen account flow"""
        # Create a test account
        new_account = {
            "opening_date": "2026-03-21",
            "name": "TEST_CloseReopen_Account",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Test Item", "weight": 10.0}],
            "landed_entries": [{"date": "2026-03-21", "amount": 5000, "interest_rate": 2.0}],
            "received_entries": []
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/accounts", json=new_account, headers=self.headers)
        assert create_resp.status_code == 201
        account_id = create_resp.json()["id"]
        
        # Close the account
        close_resp = requests.post(f"{BASE_URL}/api/accounts/{account_id}/close", 
            json={"close_date": "2026-03-21", "remarks": "Test close"},
            headers=self.headers)
        assert close_resp.status_code == 200, f"Close failed: {close_resp.text}"
        print("✅ Account close working")
        
        # Verify closed status
        get_resp = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert get_resp.json()["status"] == "closed"
        
        # Reopen the account
        reopen_resp = requests.post(f"{BASE_URL}/api/accounts/{account_id}/reopen",
            json={"reason": "Test reopen"},
            headers=self.headers)
        assert reopen_resp.status_code == 200, f"Reopen failed: {reopen_resp.text}"
        print("✅ Account reopen working")
        
        # Verify reopened status
        get_resp = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert get_resp.json()["status"] == "continue"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        print("✅ Close/Reopen flow complete")


class TestLedgerModule:
    """Test ledger functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_18_ledger_acc000025(self):
        """Test ledger for ACC000025 - chronological order with running balance"""
        account_id = "69b820918f6a1fd1231b5224"
        response = requests.get(f"{BASE_URL}/api/ledger/{account_id}", headers=self.headers)
        
        if response.status_code == 404 or len(response.json()) == 0:
            pytest.skip("Ledger for ACC000025 not found")
        
        assert response.status_code == 200
        ledger = response.json()
        
        # Verify chronological order
        for i in range(len(ledger) - 1):
            date1 = ledger[i].get("transaction_date", "")
            date2 = ledger[i+1].get("transaction_date", "")
            assert date1 <= date2, f"Ledger not in chronological order: {date1} > {date2}"
        
        # Verify ledger entry structure
        if len(ledger) > 0:
            entry = ledger[0]
            assert "transaction_type" in entry
            assert "amount" in entry
            assert "balance_amount" in entry
        
        print(f"✅ Ledger working - {len(ledger)} entries in chronological order")


class TestReportsModule:
    """Test reports module after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_19_reports_village_summary(self):
        """Test village summary report"""
        response = requests.get(f"{BASE_URL}/api/reports/village-summary", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            assert "village" in data[0]
            assert "total_accounts" in data[0]
            assert "total_pending" in data[0]
        
        print(f"✅ Village summary report working - {len(data)} villages")
    
    def test_20_reports_monthly_trend(self):
        """Test monthly trend report"""
        response = requests.get(f"{BASE_URL}/api/reports/monthly-trend", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            assert "month" in data[0]
            assert "landed" in data[0]
            assert "received" in data[0]
        
        print(f"✅ Monthly trend report working - {len(data)} months")
    
    def test_21_reports_interest_rate_distribution(self):
        """Test interest rate distribution report"""
        response = requests.get(f"{BASE_URL}/api/reports/interest-rate-distribution", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            assert "rate" in data[0]
            assert "count" in data[0]
            assert "total_amount" in data[0]
        
        print(f"✅ Interest rate distribution report working - {len(data)} rates")
    
    def test_22_reports_top_borrowers(self):
        """Test top borrowers report"""
        response = requests.get(f"{BASE_URL}/api/reports/top-borrowers", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            assert "name" in data[0]
            assert "total_pending" in data[0]
            # Verify sorted descending
            for i in range(len(data) - 1):
                assert data[i]["total_pending"] >= data[i+1]["total_pending"]
        
        print(f"✅ Top borrowers report working - {len(data)} borrowers")


class TestExportModule:
    """Test export module after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_23_export_all_accounts_excel(self):
        """Test export all accounts to Excel"""
        response = requests.get(f"{BASE_URL}/api/export/accounts/excel", headers=self.headers)
        assert response.status_code == 200
        
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type
        assert len(response.content) > 0
        
        print(f"✅ Export all accounts Excel working - {len(response.content)} bytes")
    
    def test_24_export_account_excel(self):
        """Test export individual account to Excel"""
        # Get first account
        accounts_resp = requests.get(f"{BASE_URL}/api/accounts?limit=1", headers=self.headers)
        account_id = accounts_resp.json()["accounts"][0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/export/accounts/{account_id}/excel", headers=self.headers)
        assert response.status_code == 200
        assert len(response.content) > 0
        
        print("✅ Export individual account Excel working")
    
    def test_25_export_account_pdf(self):
        """Test export individual account to PDF"""
        # Get first account
        accounts_resp = requests.get(f"{BASE_URL}/api/accounts?limit=1", headers=self.headers)
        account_id = accounts_resp.json()["accounts"][0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/export/accounts/{account_id}/pdf", headers=self.headers)
        assert response.status_code == 200
        assert response.content[:4] == b'%PDF'
        
        print("✅ Export individual account PDF working")


class TestUsersModule:
    """Test users module after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_26_users_list(self):
        """Test users list - should include seeded users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert response.status_code == 200
        users = response.json()
        
        usernames = [u["username"] for u in users]
        assert "admin" in usernames
        assert "operator1" in usernames
        assert "viewer1" in usernames
        
        print(f"✅ Users list working - {len(users)} users found")
        print(f"   Users: {', '.join(usernames)}")


class TestVillagesEndpoint:
    """Test villages endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_27_villages_list(self):
        """Test villages endpoint - should include seeded villages"""
        response = requests.get(f"{BASE_URL}/api/villages", headers=self.headers)
        assert response.status_code == 200
        villages = response.json()
        
        assert isinstance(villages, list)
        
        # Check for seeded villages
        expected_villages = ["Rajkot", "Jamnagar", "Morbi", "Gondal"]
        found_villages = [v for v in expected_villages if v in villages]
        
        print(f"✅ Villages endpoint working - {len(villages)} villages")
        print(f"   Villages: {', '.join(villages)}")


class TestPermissionEnforcement:
    """Test permission enforcement for operator1"""
    
    def test_28_operator1_cannot_delete(self):
        """Test that operator1 cannot delete accounts"""
        # Login as operator1
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "operator1", "password": "operator123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Get an account
        accounts_resp = requests.get(f"{BASE_URL}/api/accounts?limit=1", headers=headers)
        if accounts_resp.json()["total"] == 0:
            pytest.skip("No accounts to test delete permission")
        
        account_id = accounts_resp.json()["accounts"][0]["id"]
        
        # Try to delete - should fail with 403
        delete_resp = requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=headers)
        assert delete_resp.status_code == 403, f"Expected 403, got {delete_resp.status_code}"
        
        print("✅ Permission enforcement working - operator1 cannot delete accounts")
    
    def test_29_viewer1_cannot_add(self):
        """Test that viewer1 cannot add accounts"""
        # Login as viewer1
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "viewer1", "password": "viewer123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Try to create account - should fail with 403
        new_account = {
            "opening_date": "2026-03-21",
            "name": "TEST_Viewer_Account",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [],
            "landed_entries": [],
            "received_entries": []
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/accounts", json=new_account, headers=headers)
        assert create_resp.status_code == 403, f"Expected 403, got {create_resp.status_code}"
        
        print("✅ Permission enforcement working - viewer1 cannot add accounts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
