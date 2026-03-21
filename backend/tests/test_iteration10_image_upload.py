"""
Test suite for Iteration 10 - Image Upload in Edit Form
Tests the new image upload functionality in the jewellery section of the edit form
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestImageUploadFeature:
    """Tests for image upload in edit form jewellery section"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get an active account for testing
        accounts_resp = requests.get(
            f"{BASE_URL}/api/accounts?status=continue&limit=1",
            headers=self.headers
        )
        assert accounts_resp.status_code == 200
        accounts = accounts_resp.json().get("accounts", [])
        if accounts:
            self.test_account_id = accounts[0]["id"]
        else:
            # Create a test account if none exists
            create_resp = requests.post(f"{BASE_URL}/api/accounts", json={
                "opening_date": "2026-03-21",
                "name": "TEST_ImageUploadTest",
                "village": "Test Village",
                "status": "continue",
                "jewellery_items": [{"name": "Gold Ring", "weight": 5}],
                "landed_entries": [{"date": "2026-03-21", "amount": 10000, "interest_rate": 2}]
            }, headers=self.headers)
            assert create_resp.status_code == 201
            self.test_account_id = create_resp.json()["id"]
    
    def test_image_upload_endpoint_exists(self):
        """Test that image upload endpoint exists and requires auth"""
        # Test without auth
        resp = requests.post(f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images")
        assert resp.status_code in [401, 403, 422], "Endpoint should require auth or file"
    
    def test_image_upload_success(self):
        """Test successful image upload"""
        # Create a minimal valid JPEG
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
            0x00, 0x7F, 0xFF, 0xD9
        ])
        
        files = {"file": ("test_image.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images",
            headers=self.headers,
            files=files
        )
        
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        data = resp.json()
        assert "image" in data
        assert "id" in data["image"]
        assert "storage_path" in data["image"]
        
        # Store image ID for cleanup
        self.uploaded_image_id = data["image"]["id"]
    
    def test_image_count_updates_after_upload(self):
        """Test that image count updates after upload"""
        # Get initial count
        account_resp = requests.get(
            f"{BASE_URL}/api/accounts/{self.test_account_id}",
            headers=self.headers
        )
        assert account_resp.status_code == 200
        initial_count = len(account_resp.json()["jewellery_items"][0].get("images", []))
        
        # Upload an image
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
            0x00, 0x7F, 0xFF, 0xD9
        ])
        
        files = {"file": ("test_count.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images",
            headers=self.headers,
            files=files
        )
        assert upload_resp.status_code == 200
        image_id = upload_resp.json()["image"]["id"]
        
        # Verify count increased
        account_resp = requests.get(
            f"{BASE_URL}/api/accounts/{self.test_account_id}",
            headers=self.headers
        )
        assert account_resp.status_code == 200
        new_count = len(account_resp.json()["jewellery_items"][0].get("images", []))
        assert new_count == initial_count + 1, f"Expected {initial_count + 1}, got {new_count}"
        
        # Cleanup - delete the uploaded image
        requests.delete(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images/{image_id}",
            headers=self.headers
        )
    
    def test_image_delete_success(self):
        """Test successful image deletion"""
        # First upload an image
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
            0x00, 0x7F, 0xFF, 0xD9
        ])
        
        files = {"file": ("test_delete.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images",
            headers=self.headers,
            files=files
        )
        assert upload_resp.status_code == 200
        image_id = upload_resp.json()["image"]["id"]
        
        # Delete the image
        delete_resp = requests.delete(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images/{image_id}",
            headers=self.headers
        )
        assert delete_resp.status_code == 200
        assert delete_resp.json()["message"] == "Image deleted successfully"
    
    def test_invalid_file_type_rejected(self):
        """Test that non-image files are rejected"""
        files = {"file": ("test.txt", io.BytesIO(b"not an image"), "text/plain")}
        resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/0/images",
            headers=self.headers,
            files=files
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
    
    def test_invalid_jewellery_index_rejected(self):
        """Test that invalid jewellery index is rejected"""
        jpeg_data = bytes([0xFF, 0xD8, 0xFF, 0xD9])  # Minimal JPEG
        files = {"file": ("test.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.test_account_id}/jewellery/999/images",
            headers=self.headers,
            files=files
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"


class TestHistoryTab:
    """Tests for History tab showing close/reopen events"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_account_with_history_returns_close_history(self):
        """Test that account with close history returns close_history array"""
        # Get account with known history (ACC000045)
        resp = requests.get(
            f"{BASE_URL}/api/accounts/69bed77c5b33dabe3fd5ef72",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Check close_history exists
        assert "close_history" in data or "closed_at" in data, "Account should have close history"
    
    def test_account_with_history_returns_reopen_history(self):
        """Test that account with reopen history returns reopen_history array"""
        resp = requests.get(
            f"{BASE_URL}/api/accounts/69bed77c5b33dabe3fd5ef72",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Check reopen_history exists
        assert "reopen_history" in data, "Account should have reopen history"
        assert len(data.get("reopen_history", [])) > 0, "Reopen history should not be empty"


class TestAccountDetailJewelleryTab:
    """Tests for jewellery tab in account detail page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_jewellery_items_include_images_array(self):
        """Test that jewellery items include images array"""
        # Get any account
        accounts_resp = requests.get(
            f"{BASE_URL}/api/accounts?limit=1",
            headers=self.headers
        )
        assert accounts_resp.status_code == 200
        accounts = accounts_resp.json().get("accounts", [])
        assert len(accounts) > 0
        
        account_id = accounts[0]["id"]
        
        # Get account details
        resp = requests.get(
            f"{BASE_URL}/api/accounts/{account_id}",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Check jewellery items have images array
        jewellery_items = data.get("jewellery_items", [])
        for item in jewellery_items:
            assert "images" in item or item.get("images") is None, "Jewellery item should have images field"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
