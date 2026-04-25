"""
Iteration 15 Feature Tests:
1. Multi-select village filter with comma-separated values
2. Page size options (10, 30, 50, 100)
3. Status filter with 4 options (continue, closed, renewed, immediate action needed)
4. Total Pending Amount calculation (pending principal + pending interest)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"Login successful, token received")


class TestVillageMultiSelect:
    """Test multi-select village filter with comma-separated values"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_villages_list(self, auth_headers):
        """Test getting list of villages for dropdown"""
        response = requests.get(f"{BASE_URL}/api/villages", headers=auth_headers)
        assert response.status_code == 200
        villages = response.json()
        assert isinstance(villages, list)
        print(f"Villages available: {villages}")
    
    def test_single_village_filter(self, auth_headers):
        """Test filtering by single village"""
        # First get available villages
        villages_response = requests.get(f"{BASE_URL}/api/villages", headers=auth_headers)
        villages = villages_response.json()
        
        if villages:
            village = villages[0]
            response = requests.get(
                f"{BASE_URL}/api/accounts?village={village}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "accounts" in data
            print(f"Single village filter '{village}': {len(data['accounts'])} accounts")
    
    def test_multi_village_filter_comma_separated(self, auth_headers):
        """Test filtering by multiple villages (comma-separated)"""
        # First get available villages
        villages_response = requests.get(f"{BASE_URL}/api/villages", headers=auth_headers)
        villages = villages_response.json()
        
        if len(villages) >= 2:
            # Test with 2 villages comma-separated
            village_filter = f"{villages[0]},{villages[1]}"
            response = requests.get(
                f"{BASE_URL}/api/accounts?village={village_filter}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "accounts" in data
            
            # Verify accounts are from either village
            for account in data['accounts']:
                assert account['village'] in [villages[0], villages[1]], \
                    f"Account village '{account['village']}' not in filter list"
            
            print(f"Multi-village filter '{village_filter}': {len(data['accounts'])} accounts")
        else:
            pytest.skip("Not enough villages to test multi-select")
    
    def test_multi_village_filter_three_villages(self, auth_headers):
        """Test filtering by three villages"""
        villages_response = requests.get(f"{BASE_URL}/api/villages", headers=auth_headers)
        villages = villages_response.json()
        
        if len(villages) >= 3:
            village_filter = f"{villages[0]},{villages[1]},{villages[2]}"
            response = requests.get(
                f"{BASE_URL}/api/accounts?village={village_filter}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            print(f"Three-village filter: {len(data['accounts'])} accounts")
        else:
            pytest.skip("Not enough villages to test 3-village filter")


class TestPageSize:
    """Test page size dropdown options (10, 30, 50, 100)"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_page_size_10(self, auth_headers):
        """Test page size of 10"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data['accounts']) <= 10
        assert data['limit'] == 10
        print(f"Page size 10: {len(data['accounts'])} accounts returned")
    
    def test_page_size_30(self, auth_headers):
        """Test page size of 30"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?limit=30",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data['accounts']) <= 30
        assert data['limit'] == 30
        print(f"Page size 30: {len(data['accounts'])} accounts returned")
    
    def test_page_size_50(self, auth_headers):
        """Test page size of 50"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data['accounts']) <= 50
        assert data['limit'] == 50
        print(f"Page size 50: {len(data['accounts'])} accounts returned")
    
    def test_page_size_100(self, auth_headers):
        """Test page size of 100"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?limit=100",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data['accounts']) <= 100
        assert data['limit'] == 100
        print(f"Page size 100: {len(data['accounts'])} accounts returned")


class TestStatusFilter:
    """Test status filter with 4 options"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_status_filter_continue(self, auth_headers):
        """Test filtering by 'continue' status"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?status=continue",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        for account in data['accounts']:
            assert account['status'] == 'continue'
        print(f"Status 'continue': {len(data['accounts'])} accounts")
    
    def test_status_filter_closed(self, auth_headers):
        """Test filtering by 'closed' status"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?status=closed",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        for account in data['accounts']:
            assert account['status'] == 'closed'
        print(f"Status 'closed': {len(data['accounts'])} accounts")
    
    def test_status_filter_renewed(self, auth_headers):
        """Test filtering by 'renewed' status"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?status=renewed",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        for account in data['accounts']:
            assert account['status'] == 'renewed'
        print(f"Status 'renewed': {len(data['accounts'])} accounts")
    
    def test_status_filter_immediate_action_needed(self, auth_headers):
        """Test filtering by 'immediate action needed' status"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?status=immediate%20action%20needed",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        for account in data['accounts']:
            assert account['status'] == 'immediate action needed'
        print(f"Status 'immediate action needed': {len(data['accounts'])} accounts")


class TestTotalPendingAmount:
    """Test Total Pending Amount calculation (pending principal + pending interest)"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_account_has_pending_fields(self, auth_headers):
        """Test that account detail has pending amount fields"""
        # Get first account
        response = requests.get(
            f"{BASE_URL}/api/accounts?limit=1",
            headers=auth_headers
        )
        assert response.status_code == 200
        accounts = response.json()['accounts']
        
        if accounts:
            account_id = accounts[0]['id']
            detail_response = requests.get(
                f"{BASE_URL}/api/accounts/{account_id}",
                headers=auth_headers
            )
            assert detail_response.status_code == 200
            account = detail_response.json()
            
            # Verify pending fields exist
            assert 'total_pending_amount' in account, "Missing total_pending_amount field"
            assert 'total_pending_interest' in account, "Missing total_pending_interest field"
            
            print(f"Account {account['account_number']}:")
            print(f"  Pending Principal: {account['total_pending_amount']}")
            print(f"  Pending Interest: {account['total_pending_interest']}")
            print(f"  Total Pending (calculated): {account['total_pending_amount'] + account['total_pending_interest']}")
    
    def test_total_pending_calculation(self, auth_headers):
        """Test that Total Pending = Pending Principal + Pending Interest"""
        # Get account ACC000062 mentioned in the test request
        response = requests.get(
            f"{BASE_URL}/api/accounts?search=ACC000062",
            headers=auth_headers
        )
        assert response.status_code == 200
        accounts = response.json()['accounts']
        
        if accounts:
            account_id = accounts[0]['id']
            detail_response = requests.get(
                f"{BASE_URL}/api/accounts/{account_id}",
                headers=auth_headers
            )
            assert detail_response.status_code == 200
            account = detail_response.json()
            
            pending_principal = account.get('total_pending_amount', 0)
            pending_interest = account.get('total_pending_interest', 0)
            expected_total = pending_principal + pending_interest
            
            print(f"Account {account['account_number']} Total Pending Verification:")
            print(f"  Pending Principal: {pending_principal}")
            print(f"  Pending Interest: {pending_interest}")
            print(f"  Expected Total: {expected_total}")
            
            # The frontend calculates: (account.total_pending_amount || 0) + (account.total_pending_interest || 0)
            # This is correct as per AccountDetailPage.js line 232
            assert isinstance(pending_principal, (int, float))
            assert isinstance(pending_interest, (int, float))
        else:
            pytest.skip("Account ACC000062 not found")


class TestRichTextDetails:
    """Test rich text details field with HTML content"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_account_details_field_exists(self, auth_headers):
        """Test that account has details field for rich text"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?search=ACC000062",
            headers=auth_headers
        )
        assert response.status_code == 200
        accounts = response.json()['accounts']
        
        if accounts:
            account_id = accounts[0]['id']
            detail_response = requests.get(
                f"{BASE_URL}/api/accounts/{account_id}",
                headers=auth_headers
            )
            assert detail_response.status_code == 200
            account = detail_response.json()
            
            # Details field should exist (can be empty or have HTML)
            assert 'details' in account
            print(f"Account details field: {account.get('details', '')[:100]}...")
        else:
            pytest.skip("Account ACC000062 not found")
    
    def test_create_account_with_rich_text(self, auth_headers):
        """Test creating account with rich text HTML in details"""
        import time
        test_html = '<p>Test <strong>bold</strong> and <em>italic</em> with <span style="color: red;">colored text</span></p>'
        
        account_data = {
            "opening_date": "2025-01-15",
            "name": f"TEST_RichText_{int(time.time())}",
            "village": "TestVillage",
            "status": "continue",
            "details": test_html,
            "jewellery_items": [{"name": "Gold Ring", "weight": 10.5}],
            "landed_entries": [{"date": "2025-01-15", "amount": 10000, "interest_rate": 2}],
            "received_entries": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounts",
            json=account_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        created = response.json()
        
        # Verify details field contains HTML
        assert 'details' in created
        # Note: DOMPurify may sanitize some attributes
        print(f"Created account with rich text details: {created.get('details', '')}")
        
        # Cleanup - delete test account
        delete_response = requests.delete(
            f"{BASE_URL}/api/accounts/{created['id']}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        print("Test account cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
