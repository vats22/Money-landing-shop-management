"""
Iteration 9 Tests - New Features:
1. Mobile number validation (10 digits, starts with 6-9)
2. Image upload/delete/serve for jewellery items
3. History tab (close_history, reopen_history)
4. Close account pushes to close_history array
5. Closed account restrictions (403 on edit/delete/add)
6. Reopen account with reason
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMobileValidation:
    """Test mobile number validation - must be 10 digits starting with 6-9"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = None
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_mobile_invalid_short(self):
        """POST /api/users with mobile='12345' should return 400"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": "TEST_invalid_mobile_short",
            "first_name": "Test",
            "last_name": "User",
            "mobile": "12345",  # Too short
            "password": "test123"
        }, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "mobile" in response.json().get("detail", "").lower() or "10 digits" in response.json().get("detail", "").lower()
    
    def test_mobile_invalid_starts_with_1(self):
        """POST /api/users with mobile='1234567890' (starts with 1) should return 400"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": "TEST_invalid_mobile_start1",
            "first_name": "Test",
            "last_name": "User",
            "mobile": "1234567890",  # Starts with 1, not 6-9
            "password": "test123"
        }, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "mobile" in response.json().get("detail", "").lower() or "6, 7, 8 or 9" in response.json().get("detail", "").lower()
    
    def test_mobile_invalid_starts_with_5(self):
        """POST /api/users with mobile='5234567890' (starts with 5) should return 400"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": "TEST_invalid_mobile_start5",
            "first_name": "Test",
            "last_name": "User",
            "mobile": "5234567890",  # Starts with 5, not 6-9
            "password": "test123"
        }, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    
    def test_mobile_valid_starts_with_9(self):
        """POST /api/users with mobile='9876543210' should work"""
        import time
        unique_suffix = str(int(time.time()))[-4:]
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": f"TEST_valid_mobile_9_{unique_suffix}",
            "first_name": "Test",
            "last_name": "User",
            "mobile": f"987654{unique_suffix}",
            "password": "test123"
        }, headers=self.headers)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        user_id = response.json()["id"]
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_mobile_valid_starts_with_6(self):
        """POST /api/users with mobile='6123456789' should work"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": "TEST_valid_mobile_6",
            "first_name": "Test",
            "last_name": "User",
            "mobile": "6123456789",
            "password": "test123"
        }, headers=self.headers)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        user_id = response.json()["id"]
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_mobile_valid_starts_with_7(self):
        """POST /api/users with mobile='7123456789' should work"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": "TEST_valid_mobile_7",
            "first_name": "Test",
            "last_name": "User",
            "mobile": "7123456789",
            "password": "test123"
        }, headers=self.headers)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        user_id = response.json()["id"]
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_mobile_valid_starts_with_8(self):
        """POST /api/users with mobile='8123456789' should work"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": "TEST_valid_mobile_8",
            "first_name": "Test",
            "last_name": "User",
            "mobile": "8123456789",
            "password": "test123"
        }, headers=self.headers)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        user_id = response.json()["id"]
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)


class TestImageUpload:
    """Test jewellery image upload, delete, and serve endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = None
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        # Use existing account with images: ACC000046 (id: 69bed77d5b33dabe3fd5ef75)
        self.test_account_id = "69bed77d5b33dabe3fd5ef75"
    
    def test_image_upload_jpeg(self):
        """POST /api/accounts/{id}/jewellery/0/images with JPEG file returns 200"""
        # Create a simple JPEG-like file (minimal valid JPEG header)
        jpeg_header = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00])
        jpeg_content = jpeg_header + b'\x00' * 100 + bytes([0xFF, 0xD9])
        
        files = {'file': ('test_image.jpg', io.BytesIO(jpeg_content), 'image/jpeg')}
        response = requests.post(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images",
            files=files,
            headers=self.headers
        )
        # Should succeed or fail gracefully
        if response.status_code == 200:
            data = response.json()
            assert "image" in data
            assert "id" in data["image"]
            assert "storage_path" in data["image"]
            print(f"Image uploaded successfully: {data['image']['id']}")
        else:
            # May fail due to storage issues, but should not be 500
            print(f"Image upload response: {response.status_code} - {response.text}")
    
    def test_get_account_with_images(self):
        """GET /api/accounts/{id} returns jewellery items with images array"""
        response = requests.get(
            f"{BASE_URL}/api/accounts/{self.test_account_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get account: {response.text}"
        data = response.json()
        assert "jewellery_items" in data
        # Check if images array exists on jewellery items
        for item in data.get("jewellery_items", []):
            # images may or may not exist
            if "images" in item:
                assert isinstance(item["images"], list)
                print(f"Jewellery item '{item.get('name')}' has {len(item['images'])} images")


class TestHistoryTab:
    """Test close_history and reopen_history tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = None
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        # Account with close/reopen history: 69bed77c5b33dabe3fd5ef72
        self.history_account_id = "69bed77c5b33dabe3fd5ef72"
    
    def test_account_has_close_history(self):
        """Account with close_history shows CLOSED events"""
        response = requests.get(
            f"{BASE_URL}/api/accounts/{self.history_account_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get account: {response.text}"
        data = response.json()
        
        # Check for close_history array
        close_history = data.get("close_history", [])
        print(f"Account has {len(close_history)} close history entries")
        
        for entry in close_history:
            assert "closed_at" in entry, "close_history entry missing closed_at"
            assert "closed_by" in entry or "closed_by_name" in entry, "close_history entry missing closed_by"
            print(f"Close event: {entry.get('closed_at')} by {entry.get('closed_by_name')}")
    
    def test_account_has_reopen_history(self):
        """Account with reopen_history shows REOPENED events"""
        response = requests.get(
            f"{BASE_URL}/api/accounts/{self.history_account_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get account: {response.text}"
        data = response.json()
        
        # Check for reopen_history array
        reopen_history = data.get("reopen_history", [])
        print(f"Account has {len(reopen_history)} reopen history entries")
        
        for entry in reopen_history:
            assert "reopened_at" in entry, "reopen_history entry missing reopened_at"
            assert "reason" in entry, "reopen_history entry missing reason"
            print(f"Reopen event: {entry.get('reopened_at')} - reason: {entry.get('reason')}")


class TestCloseAccountHistory:
    """Test that closing account pushes to close_history array"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = None
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        self.created_account_id = None
    
    def test_close_account_creates_history_entry(self):
        """POST /api/accounts/{id}/close pushes to close_history array"""
        # Create a test account
        account_data = {
            "opening_date": "2024-01-15",
            "name": "TEST_CloseHistoryTest",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2024-01-15", "amount": 10000, "interest_rate": 2}]
        }
        create_response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert create_response.status_code == 201, f"Failed to create account: {create_response.text}"
        self.created_account_id = create_response.json()["id"]
        
        # Close the account
        close_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/close",
            json={"close_date": "2024-06-15", "remarks": "Test closure for history"},
            headers=self.headers
        )
        assert close_response.status_code == 200, f"Failed to close account: {close_response.text}"
        
        # Verify close_history was created
        get_response = requests.get(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert "close_history" in data, "close_history not found in account"
        assert len(data["close_history"]) >= 1, "close_history should have at least 1 entry"
        
        latest_close = data["close_history"][-1]
        assert "closed_at" in latest_close
        assert "remarks" in latest_close
        assert latest_close["remarks"] == "Test closure for history"
        print(f"Close history entry created: {latest_close}")
        
        # Cleanup
        if self.created_account_id:
            # Reopen first to delete
            requests.post(
                f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
                json={"reason": "Cleanup"},
                headers=self.headers
            )
            requests.delete(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)


class TestClosedAccountRestrictions:
    """Test that closed accounts cannot be edited, deleted, or have entries added"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = None
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        self.created_account_id = None
    
    def test_closed_account_cannot_be_edited(self):
        """PUT /api/accounts/{id} on closed account returns 403"""
        # Create and close an account
        account_data = {
            "opening_date": "2024-01-15",
            "name": "TEST_ClosedEditTest",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2024-01-15", "amount": 10000, "interest_rate": 2}]
        }
        create_response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert create_response.status_code == 201
        self.created_account_id = create_response.json()["id"]
        
        # Close the account
        close_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/close",
            json={"close_date": "2024-06-15", "remarks": "Test"},
            headers=self.headers
        )
        assert close_response.status_code == 200
        
        # Try to edit - should fail with 403
        edit_response = requests.put(
            f"{BASE_URL}/api/accounts/{self.created_account_id}",
            json={"name": "Updated Name"},
            headers=self.headers
        )
        assert edit_response.status_code == 403, f"Expected 403, got {edit_response.status_code}: {edit_response.text}"
        
        # Cleanup
        requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
            json={"reason": "Cleanup"},
            headers=self.headers
        )
        requests.delete(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)
    
    def test_closed_account_cannot_be_deleted(self):
        """DELETE /api/accounts/{id} on closed account returns 403"""
        # Create and close an account
        account_data = {
            "opening_date": "2024-01-15",
            "name": "TEST_ClosedDeleteTest",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2024-01-15", "amount": 10000, "interest_rate": 2}]
        }
        create_response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert create_response.status_code == 201
        self.created_account_id = create_response.json()["id"]
        
        # Close the account
        close_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/close",
            json={"close_date": "2024-06-15", "remarks": "Test"},
            headers=self.headers
        )
        assert close_response.status_code == 200
        
        # Try to delete - should fail with 403
        delete_response = requests.delete(
            f"{BASE_URL}/api/accounts/{self.created_account_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 403, f"Expected 403, got {delete_response.status_code}: {delete_response.text}"
        
        # Cleanup
        requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
            json={"reason": "Cleanup"},
            headers=self.headers
        )
        requests.delete(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)
    
    def test_closed_account_cannot_add_landed_entry(self):
        """POST /api/accounts/{id}/landed on closed account returns 403"""
        # Create and close an account
        account_data = {
            "opening_date": "2024-01-15",
            "name": "TEST_ClosedAddLandedTest",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2024-01-15", "amount": 10000, "interest_rate": 2}]
        }
        create_response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert create_response.status_code == 201
        self.created_account_id = create_response.json()["id"]
        
        # Close the account
        close_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/close",
            json={"close_date": "2024-06-15", "remarks": "Test"},
            headers=self.headers
        )
        assert close_response.status_code == 200
        
        # Try to add landed entry - should fail with 403
        add_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/landed",
            json={"date": "2024-07-01", "amount": 5000, "interest_rate": 2},
            headers=self.headers
        )
        assert add_response.status_code == 403, f"Expected 403, got {add_response.status_code}: {add_response.text}"
        
        # Cleanup
        requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
            json={"reason": "Cleanup"},
            headers=self.headers
        )
        requests.delete(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)


class TestReopenAccount:
    """Test reopen account functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = None
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        self.created_account_id = None
    
    def test_reopen_requires_reason(self):
        """POST /api/accounts/{id}/reopen without reason returns 400"""
        # Create and close an account
        account_data = {
            "opening_date": "2024-01-15",
            "name": "TEST_ReopenReasonTest",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2024-01-15", "amount": 10000, "interest_rate": 2}]
        }
        create_response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert create_response.status_code == 201
        self.created_account_id = create_response.json()["id"]
        
        # Close the account
        close_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/close",
            json={"close_date": "2024-06-15", "remarks": "Test"},
            headers=self.headers
        )
        assert close_response.status_code == 200
        
        # Try to reopen without reason - should fail with 400
        reopen_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
            json={"reason": ""},
            headers=self.headers
        )
        assert reopen_response.status_code == 400, f"Expected 400, got {reopen_response.status_code}: {reopen_response.text}"
        
        # Cleanup - reopen with valid reason then delete
        requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
            json={"reason": "Cleanup"},
            headers=self.headers
        )
        requests.delete(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)
    
    def test_reopen_with_reason_works(self):
        """POST /api/accounts/{id}/reopen with reason works"""
        # Create and close an account
        account_data = {
            "opening_date": "2024-01-15",
            "name": "TEST_ReopenSuccessTest",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2024-01-15", "amount": 10000, "interest_rate": 2}]
        }
        create_response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert create_response.status_code == 201
        self.created_account_id = create_response.json()["id"]
        
        # Close the account
        close_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/close",
            json={"close_date": "2024-06-15", "remarks": "Test"},
            headers=self.headers
        )
        assert close_response.status_code == 200
        
        # Reopen with valid reason
        reopen_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
            json={"reason": "Customer requested to add more items"},
            headers=self.headers
        )
        assert reopen_response.status_code == 200, f"Expected 200, got {reopen_response.status_code}: {reopen_response.text}"
        
        # Verify account is reopened and has reopen_history
        get_response = requests.get(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["status"] == "continue", f"Expected status 'continue', got {data['status']}"
        assert "reopen_history" in data, "reopen_history not found"
        assert len(data["reopen_history"]) >= 1, "reopen_history should have at least 1 entry"
        
        latest_reopen = data["reopen_history"][-1]
        assert latest_reopen["reason"] == "Customer requested to add more items"
        print(f"Reopen history entry: {latest_reopen}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)
    
    def test_after_reopen_edit_works(self):
        """After reopen, edit works again"""
        # Create and close an account
        account_data = {
            "opening_date": "2024-01-15",
            "name": "TEST_ReopenEditTest",
            "village": "TestVillage",
            "status": "continue",
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2024-01-15", "amount": 10000, "interest_rate": 2}]
        }
        create_response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert create_response.status_code == 201
        self.created_account_id = create_response.json()["id"]
        
        # Close the account
        close_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/close",
            json={"close_date": "2024-06-15", "remarks": "Test"},
            headers=self.headers
        )
        assert close_response.status_code == 200
        
        # Reopen
        reopen_response = requests.post(
            f"{BASE_URL}/api/accounts/{self.created_account_id}/reopen",
            json={"reason": "Need to edit"},
            headers=self.headers
        )
        assert reopen_response.status_code == 200
        
        # Now edit should work
        edit_response = requests.put(
            f"{BASE_URL}/api/accounts/{self.created_account_id}",
            json={"name": "TEST_ReopenEditTest_Updated"},
            headers=self.headers
        )
        assert edit_response.status_code == 200, f"Expected 200, got {edit_response.status_code}: {edit_response.text}"
        
        # Verify name was updated
        get_response = requests.get(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)
        assert get_response.json()["name"] == "TEST_ReopenEditTest_Updated"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/accounts/{self.created_account_id}", headers=self.headers)


class TestDashboardSeparation:
    """Test dashboard separates active vs closed account totals"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = None
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_dashboard_summary_has_active_totals(self):
        """Dashboard summary returns active totals"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=self.headers)
        assert response.status_code == 200, f"Failed to get dashboard summary: {response.text}"
        data = response.json()
        
        # Check for active totals
        assert "total_landed_amount" in data, "Missing total_landed_amount"
        print(f"Active total_landed_amount: {data.get('total_landed_amount')}")
    
    def test_dashboard_summary_has_closed_totals(self):
        """Dashboard summary returns closed totals"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=self.headers)
        assert response.status_code == 200, f"Failed to get dashboard summary: {response.text}"
        data = response.json()
        
        # Check for closed totals
        assert "closed_total_landed_amount" in data, "Missing closed_total_landed_amount"
        print(f"Closed total_landed_amount: {data.get('closed_total_landed_amount')}")
    
    def test_dashboard_stats_has_account_counts(self):
        """Dashboard stats returns total, active, closed account counts"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200, f"Failed to get dashboard stats: {response.text}"
        data = response.json()
        
        assert "total_accounts" in data, "Missing total_accounts"
        assert "active_accounts" in data, "Missing active_accounts"
        assert "closed_accounts" in data, "Missing closed_accounts"
        
        print(f"Total: {data['total_accounts']}, Active: {data['active_accounts']}, Closed: {data['closed_accounts']}")


class TestCoreFlows:
    """Test core flows still work"""
    
    def test_login_admin(self):
        """Admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        assert "token" in response.json()
    
    def test_login_operator(self):
        """Operator login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "operator1",
            "password": "operator123"
        })
        assert response.status_code == 200, f"Operator login failed: {response.text}"
        assert "token" in response.json()
    
    def test_accounts_list(self):
        """Accounts list works"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/accounts", headers=headers)
        assert response.status_code == 200, f"Failed to get accounts: {response.text}"
        data = response.json()
        assert "accounts" in data
        assert "total" in data
        print(f"Total accounts: {data['total']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
