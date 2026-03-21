"""
Iteration 8 Bug Fixes Test Suite
Tests for:
1. Permissions not reflecting - backend matched_count + AuthContext refreshUser
2. Add/Edit button visibility based on permissions
3. Sidebar nav filtered by permissions
4. Village searchable dropdown instead of text input
5. Closed accounts can't be edited/deleted - must reopen first
6. Dashboard separates active vs closed account totals
7. DateRangePicker component with dual-month calendar and preset buttons
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
OPERATOR1_CREDS = {"username": "operator1", "password": "operator123"}
VIEWER1_CREDS = {"username": "viewer1", "password": "viewer123"}

# User IDs from context
OPERATOR1_ID = "69bebd76b09bf615fb3f0790"
VIEWER1_ID = "69bebd76b09bf615fb3f0791"


class TestAuthAndPermissions:
    """Test authentication and permission flows"""
    
    def test_admin_login(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_admin"] == True
        print("✓ Admin login successful")
    
    def test_operator1_login(self):
        """Operator1 can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR1_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_admin"] == False
        print(f"✓ Operator1 login successful, permissions: {data['user'].get('permissions', {})}")
    
    def test_viewer1_login(self):
        """Viewer1 can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER1_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_admin"] == False
        print(f"✓ Viewer1 login successful, permissions: {data['user'].get('permissions', {})}")
    
    def test_auth_me_returns_permissions(self):
        """GET /api/auth/me returns user with permissions"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR1_CREDS)
        token = login_resp.json()["token"]
        
        # Get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        print(f"✓ /api/auth/me returns permissions: {data.get('permissions', {})}")


class TestPermissionUpdate:
    """Bug 1: Test that permission updates reflect correctly"""
    
    def test_admin_can_update_user_permissions(self):
        """Admin can update user permissions via PUT /api/users/{id}/permissions"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        admin_token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current operator1 permissions
        me_resp = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR1_CREDS)
        original_perms = me_resp.json()["user"].get("permissions", {})
        print(f"Original operator1 permissions: {original_perms}")
        
        # Update permissions - remove accounts.add
        new_permissions = {
            "accounts": {
                "view": True,
                "add": False,  # Remove add permission
                "update": True,
                "delete": False,
                "close": False
            }
        }
        
        update_resp = requests.put(
            f"{BASE_URL}/api/users/{OPERATOR1_ID}/permissions",
            json=new_permissions,
            headers=headers
        )
        assert update_resp.status_code == 200
        print(f"✓ Permission update response: {update_resp.json()}")
        
        # Verify by logging in as operator1 again
        login_resp2 = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR1_CREDS)
        updated_perms = login_resp2.json()["user"].get("permissions", {})
        print(f"Updated operator1 permissions: {updated_perms}")
        
        # Verify add permission is now False
        assert updated_perms.get("accounts", {}).get("add") == False
        print("✓ Permission update reflected correctly")
        
        # Restore original permissions
        restore_perms = {
            "accounts": {
                "view": True,
                "add": True,
                "update": True,
                "delete": False,
                "close": False
            }
        }
        requests.put(f"{BASE_URL}/api/users/{OPERATOR1_ID}/permissions", json=restore_perms, headers=headers)
        print("✓ Permissions restored")
    
    def test_permission_update_uses_matched_count(self):
        """Verify permission update endpoint uses matched_count (not modified_count)"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        admin_token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current permissions
        me_resp = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR1_CREDS)
        current_perms = me_resp.json()["user"].get("permissions", {})
        
        # Update with same permissions (should still return 200, not 404)
        update_resp = requests.put(
            f"{BASE_URL}/api/users/{OPERATOR1_ID}/permissions",
            json=current_perms,
            headers=headers
        )
        # Should return 200 even if no changes made (matched_count > 0)
        assert update_resp.status_code == 200
        print("✓ Permission update with same values returns 200 (uses matched_count)")


class TestClosedAccountRestrictions:
    """Bug 5: Closed accounts can't be edited/deleted - must reopen first"""
    
    @pytest.fixture
    def admin_token(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return login_resp.json()["token"]
    
    @pytest.fixture
    def test_account(self, admin_token):
        """Create a test account for close/reopen testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        account_data = {
            "opening_date": "2026-01-15",
            "name": "TEST_ClosedAccountTest",
            "village": "Test Village",
            "status": "continue",
            "details": "Test account for closed account restrictions",
            "jewellery_items": [{"name": "Gold Ring", "weight": 5.0}],
            "landed_entries": [{"date": "2026-01-15", "amount": 10000, "interest_rate": 2}],
            "received_entries": []
        }
        
        response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=headers)
        assert response.status_code == 201
        account = response.json()
        yield account
        
        # Cleanup - try to delete (may need to reopen first)
        try:
            requests.delete(f"{BASE_URL}/api/accounts/{account['id']}", headers=headers)
        except:
            # If closed, reopen first
            requests.post(f"{BASE_URL}/api/accounts/{account['id']}/reopen", 
                         json={"reason": "Cleanup"}, headers=headers)
            requests.delete(f"{BASE_URL}/api/accounts/{account['id']}", headers=headers)
    
    def test_close_account_flow(self, admin_token, test_account):
        """Test closing an account"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        account_id = test_account["id"]
        
        # Close the account
        close_resp = requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/close",
            json={"close_date": "2026-01-20", "remarks": "Test closure"},
            headers=headers
        )
        assert close_resp.status_code == 200
        print(f"✓ Account closed: {close_resp.json()}")
    
    def test_closed_account_detail_shows_user_can_edit_false(self, admin_token, test_account):
        """GET account detail shows user_can_edit=false for closed accounts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        account_id = test_account["id"]
        
        # Close the account first
        requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/close",
            json={"close_date": "2026-01-20", "remarks": "Test closure"},
            headers=headers
        )
        
        # Get account detail
        detail_resp = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=headers)
        assert detail_resp.status_code == 200
        data = detail_resp.json()
        
        assert data["status"] == "closed"
        assert data["user_can_edit"] == False
        assert data["user_can_delete"] == False
        assert data["user_can_add"] == False
        assert data["user_can_close"] == False
        print("✓ Closed account shows user_can_edit=false, user_can_delete=false")
    
    def test_closed_account_update_returns_403(self, admin_token, test_account):
        """PUT update on closed account returns 403"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        account_id = test_account["id"]
        
        # Close the account first
        requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/close",
            json={"close_date": "2026-01-20", "remarks": "Test closure"},
            headers=headers
        )
        
        # Try to update
        update_resp = requests.put(
            f"{BASE_URL}/api/accounts/{account_id}",
            json={"name": "Updated Name"},
            headers=headers
        )
        assert update_resp.status_code == 403
        assert "closed" in update_resp.json()["detail"].lower() or "reopen" in update_resp.json()["detail"].lower()
        print(f"✓ Update on closed account returns 403: {update_resp.json()['detail']}")
    
    def test_closed_account_delete_returns_403(self, admin_token, test_account):
        """DELETE on closed account returns 403"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        account_id = test_account["id"]
        
        # Close the account first
        requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/close",
            json={"close_date": "2026-01-20", "remarks": "Test closure"},
            headers=headers
        )
        
        # Try to delete
        delete_resp = requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=headers)
        assert delete_resp.status_code == 403
        assert "closed" in delete_resp.json()["detail"].lower() or "reopen" in delete_resp.json()["detail"].lower()
        print(f"✓ Delete on closed account returns 403: {delete_resp.json()['detail']}")
    
    def test_closed_account_add_landed_returns_403(self, admin_token, test_account):
        """POST add landed entry on closed account returns 403"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        account_id = test_account["id"]
        
        # Close the account first
        requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/close",
            json={"close_date": "2026-01-20", "remarks": "Test closure"},
            headers=headers
        )
        
        # Try to add landed entry
        add_resp = requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/landed",
            json={"date": "2026-01-21", "amount": 5000, "interest_rate": 2},
            headers=headers
        )
        assert add_resp.status_code == 403
        print(f"✓ Add landed on closed account returns 403: {add_resp.json()['detail']}")
    
    def test_reopen_account_requires_reason(self, admin_token, test_account):
        """Reopen account requires a reason"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        account_id = test_account["id"]
        
        # Close the account first
        requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/close",
            json={"close_date": "2026-01-20", "remarks": "Test closure"},
            headers=headers
        )
        
        # Try to reopen without reason
        reopen_resp = requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/reopen",
            json={"reason": ""},
            headers=headers
        )
        assert reopen_resp.status_code == 400
        print(f"✓ Reopen without reason returns 400: {reopen_resp.json()['detail']}")
    
    def test_reopen_then_edit_works(self, admin_token, test_account):
        """After reopening, edit works again"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        account_id = test_account["id"]
        
        # Close the account
        requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/close",
            json={"close_date": "2026-01-20", "remarks": "Test closure"},
            headers=headers
        )
        
        # Reopen with reason
        reopen_resp = requests.post(
            f"{BASE_URL}/api/accounts/{account_id}/reopen",
            json={"reason": "Need to add more entries"},
            headers=headers
        )
        assert reopen_resp.status_code == 200
        print(f"✓ Account reopened: {reopen_resp.json()}")
        
        # Now update should work
        update_resp = requests.put(
            f"{BASE_URL}/api/accounts/{account_id}",
            json={"details": "Updated after reopen"},
            headers=headers
        )
        assert update_resp.status_code == 200
        print("✓ Update after reopen works")


class TestDashboardSeparation:
    """Bug 6: Dashboard separates active vs closed account totals"""
    
    def test_dashboard_summary_has_closed_fields(self):
        """Dashboard summary returns both active and closed totals"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get dashboard summary
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check active fields exist
        assert "total_landed_amount" in data
        assert "total_received_amount" in data
        assert "total_pending_amount" in data
        assert "total_pending_interest" in data
        
        # Check closed fields exist
        assert "closed_total_landed_amount" in data
        assert "closed_total_received_amount" in data
        assert "closed_total_pending_amount" in data
        assert "closed_total_pending_interest" in data
        
        print(f"✓ Dashboard summary has active totals: landed={data['total_landed_amount']}, pending={data['total_pending_amount']}")
        print(f"✓ Dashboard summary has closed totals: landed={data['closed_total_landed_amount']}, pending={data['closed_total_pending_amount']}")
    
    def test_dashboard_stats_has_closed_count(self):
        """Dashboard stats returns closed_accounts count"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get dashboard stats
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_accounts" in data
        assert "active_accounts" in data
        assert "closed_accounts" in data
        
        print(f"✓ Dashboard stats: total={data['total_accounts']}, active={data['active_accounts']}, closed={data['closed_accounts']}")


class TestVillagesEndpoint:
    """Bug 4: Village searchable dropdown - verify villages endpoint"""
    
    def test_villages_endpoint_returns_list(self):
        """GET /api/villages returns list of unique villages"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get villages
        response = requests.get(f"{BASE_URL}/api/villages", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Villages endpoint returns {len(data)} villages: {data[:5]}...")


class TestPermissionBasedAccess:
    """Bug 2 & 3: Test permission-based access to endpoints"""
    
    def test_viewer_cannot_add_account(self):
        """Viewer1 (view only) cannot create account"""
        # Login as viewer1
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER1_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to create account
        account_data = {
            "opening_date": "2026-01-15",
            "name": "TEST_ViewerAccount",
            "village": "Test Village",
            "status": "continue",
            "details": "Should fail",
            "jewellery_items": [],
            "landed_entries": [{"date": "2026-01-15", "amount": 1000, "interest_rate": 2}],
            "received_entries": []
        }
        
        response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=headers)
        assert response.status_code == 403
        print(f"✓ Viewer cannot add account: {response.json()['detail']}")
    
    def test_viewer_can_view_accounts(self):
        """Viewer1 can view accounts list"""
        # Login as viewer1
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER1_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get accounts
        response = requests.get(f"{BASE_URL}/api/accounts", headers=headers)
        assert response.status_code == 200
        print(f"✓ Viewer can view accounts: {response.json()['total']} accounts")
    
    def test_non_admin_cannot_access_users(self):
        """Non-admin cannot access users endpoint"""
        # Login as operator1
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR1_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to get users
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 403
        print(f"✓ Non-admin cannot access users: {response.json()['detail']}")


class TestAccountFilters:
    """Test account filtering including date range"""
    
    def test_accounts_filter_by_status(self):
        """Filter accounts by status works"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get closed accounts
        response = requests.get(f"{BASE_URL}/api/accounts?status=closed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # All returned accounts should be closed
        for account in data["accounts"]:
            assert account["status"] == "closed"
        
        print(f"✓ Status filter works: {data['total']} closed accounts")
    
    def test_accounts_filter_by_village(self):
        """Filter accounts by village works"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get villages first
        villages_resp = requests.get(f"{BASE_URL}/api/villages", headers=headers)
        villages = villages_resp.json()
        
        if villages:
            test_village = villages[0]
            response = requests.get(f"{BASE_URL}/api/accounts?village={test_village}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            
            # All returned accounts should have matching village
            for account in data["accounts"]:
                assert test_village.lower() in account["village"].lower()
            
            print(f"✓ Village filter works: {data['total']} accounts in {test_village}")
    
    def test_accounts_filter_by_date_range(self):
        """Filter accounts by date range works"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get accounts with date range
        response = requests.get(
            f"{BASE_URL}/api/accounts?start_date=2026-01-01&end_date=2026-12-31",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Date range filter works: {data['total']} accounts in 2026")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
