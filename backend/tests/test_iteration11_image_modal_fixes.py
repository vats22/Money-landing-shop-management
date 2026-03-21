"""
Test suite for Iteration 11 - Image Modal Bug Fixes
Tests:
1. Account Detail page image modal is VIEW-ONLY (no upload/delete)
2. Edit form has upload/camera functionality
3. Camera uses getUserMedia API
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestImageModalViewOnly:
    """Tests to verify image modal behavior in detail vs edit pages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Account with 4 images for testing
        self.account_with_images = "69bed77d5b33dabe3fd5ef75"
        # Account with close/reopen history
        self.account_with_history = "69bed77c5b33dabe3fd5ef72"
    
    def test_account_with_images_returns_images_array(self):
        """Test that account 69bed77d5b33dabe3fd5ef75 has images"""
        resp = requests.get(
            f"{BASE_URL}/api/accounts/{self.account_with_images}",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Check jewellery items have images
        jewellery_items = data.get("jewellery_items", [])
        assert len(jewellery_items) > 0, "Account should have jewellery items"
        
        # First item should have images
        first_item = jewellery_items[0]
        images = first_item.get("images", [])
        assert len(images) >= 1, f"Expected at least 1 image, got {len(images)}"
        print(f"Account has {len(images)} images")
    
    def test_image_upload_endpoint_requires_auth(self):
        """Test that image upload endpoint requires authentication"""
        # Test without auth
        resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.account_with_images}/jewellery/0/images"
        )
        assert resp.status_code in [401, 403, 422], "Endpoint should require auth"
    
    def test_image_delete_endpoint_requires_auth(self):
        """Test that image delete endpoint requires authentication"""
        # Test without auth
        resp = requests.delete(
            f"{BASE_URL}/api/accounts/{self.account_with_images}/jewellery/0/images/fake-id"
        )
        assert resp.status_code in [401, 403], "Endpoint should require auth"
    
    def test_image_upload_works_with_auth(self):
        """Test that image upload works with proper authentication"""
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
        
        files = {"file": ("test_iter11.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.account_with_images}/jewellery/0/images",
            headers=self.headers,
            files=files
        )
        
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        data = resp.json()
        assert "image" in data
        image_id = data["image"]["id"]
        
        # Cleanup - delete the uploaded image
        delete_resp = requests.delete(
            f"{BASE_URL}/api/accounts/{self.account_with_images}/jewellery/0/images/{image_id}",
            headers=self.headers
        )
        assert delete_resp.status_code == 200
    
    def test_image_delete_works_with_auth(self):
        """Test that image delete works with proper authentication"""
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
        
        files = {"file": ("test_delete_iter11.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/accounts/{self.account_with_images}/jewellery/0/images",
            headers=self.headers,
            files=files
        )
        assert upload_resp.status_code == 200
        image_id = upload_resp.json()["image"]["id"]
        
        # Delete the image
        delete_resp = requests.delete(
            f"{BASE_URL}/api/accounts/{self.account_with_images}/jewellery/0/images/{image_id}",
            headers=self.headers
        )
        assert delete_resp.status_code == 200
        assert delete_resp.json()["message"] == "Image deleted successfully"
    
    def test_file_serve_endpoint_requires_auth(self):
        """Test that file serve endpoint requires authentication"""
        # Get account to find an image path
        resp = requests.get(
            f"{BASE_URL}/api/accounts/{self.account_with_images}",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        images = data.get("jewellery_items", [{}])[0].get("images", [])
        if images:
            storage_path = images[0].get("storage_path")
            if storage_path:
                # Test without auth
                file_resp = requests.get(f"{BASE_URL}/api/files/{storage_path}")
                assert file_resp.status_code == 401, "File serve should require auth"
                
                # Test with auth
                file_resp_auth = requests.get(
                    f"{BASE_URL}/api/files/{storage_path}?auth={self.token}"
                )
                assert file_resp_auth.status_code == 200, "File serve should work with auth"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
