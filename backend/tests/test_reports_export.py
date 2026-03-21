"""
Test suite for Reports & Export Features - Iteration 6
Tests:
1. Reports API endpoints (village-summary, monthly-trend, interest-rate-distribution, top-borrowers)
2. Export API endpoints (all accounts Excel, individual account Excel/PDF)
3. Bug fix verification: Account ACC000025 Entry 2 interest_start_date = 2026-03-10
4. Core flows: Login, Dashboard, Account list, Account detail
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lending-vault.preview.emergentagent.com').rstrip('/')

class TestReportsAndExport:
    """Test Reports & Export features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        yield
    
    # ==================== HEALTH & AUTH ====================
    
    def test_01_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ API health check passed")
    
    def test_02_login_flow(self):
        """Verify login works with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == "admin"
        print("✅ Login flow working")
    
    # ==================== REPORTS API ====================
    
    def test_03_reports_village_summary(self):
        """Test /api/reports/village-summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/village-summary", headers=self.headers)
        assert response.status_code == 200, f"Village summary failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Village summary should return a list"
        
        # If data exists, verify structure
        if len(data) > 0:
            village = data[0]
            assert "village" in village, "Missing 'village' field"
            assert "total_accounts" in village, "Missing 'total_accounts' field"
            assert "active_accounts" in village, "Missing 'active_accounts' field"
            assert "total_landed" in village, "Missing 'total_landed' field"
            assert "total_received" in village, "Missing 'total_received' field"
            assert "total_pending" in village, "Missing 'total_pending' field"
            assert "total_interest" in village, "Missing 'total_interest' field"
            
            print(f"✅ Village summary working - {len(data)} villages found")
            for v in data[:3]:  # Print first 3
                print(f"   {v['village']}: {v['total_accounts']} accounts, Pending: ₹{v['total_pending']}")
        else:
            print("✅ Village summary working - no data (empty)")
    
    def test_04_reports_monthly_trend(self):
        """Test /api/reports/monthly-trend endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/monthly-trend", headers=self.headers)
        assert response.status_code == 200, f"Monthly trend failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Monthly trend should return a list"
        
        # If data exists, verify structure
        if len(data) > 0:
            month = data[0]
            assert "month" in month, "Missing 'month' field"
            assert "landed" in month, "Missing 'landed' field"
            assert "received" in month, "Missing 'received' field"
            assert "accounts_opened" in month, "Missing 'accounts_opened' field"
            
            print(f"✅ Monthly trend working - {len(data)} months found")
            for m in data[-3:]:  # Print last 3 months
                print(f"   {m['month']}: Landed ₹{m['landed']}, Received ₹{m['received']}")
        else:
            print("✅ Monthly trend working - no data (empty)")
    
    def test_05_reports_interest_rate_distribution(self):
        """Test /api/reports/interest-rate-distribution endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/interest-rate-distribution", headers=self.headers)
        assert response.status_code == 200, f"Interest rate distribution failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Interest rate distribution should return a list"
        
        # If data exists, verify structure
        if len(data) > 0:
            rate = data[0]
            assert "rate" in rate, "Missing 'rate' field"
            assert "count" in rate, "Missing 'count' field"
            assert "total_amount" in rate, "Missing 'total_amount' field"
            
            print(f"✅ Interest rate distribution working - {len(data)} rates found")
            for r in data:
                print(f"   {r['rate']}: {r['count']} entries, Total ₹{r['total_amount']}")
        else:
            print("✅ Interest rate distribution working - no data (empty)")
    
    def test_06_reports_top_borrowers(self):
        """Test /api/reports/top-borrowers endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/top-borrowers", headers=self.headers)
        assert response.status_code == 200, f"Top borrowers failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Top borrowers should return a list"
        
        # If data exists, verify structure
        if len(data) > 0:
            borrower = data[0]
            assert "account_number" in borrower, "Missing 'account_number' field"
            assert "name" in borrower, "Missing 'name' field"
            assert "village" in borrower, "Missing 'village' field"
            assert "total_landed" in borrower, "Missing 'total_landed' field"
            assert "total_pending" in borrower, "Missing 'total_pending' field"
            assert "total_interest" in borrower, "Missing 'total_interest' field"
            assert "status" in borrower, "Missing 'status' field"
            
            # Verify sorted by pending amount (descending)
            if len(data) > 1:
                for i in range(len(data) - 1):
                    assert data[i]["total_pending"] >= data[i+1]["total_pending"], \
                        "Top borrowers should be sorted by pending amount descending"
            
            print(f"✅ Top borrowers working - {len(data)} borrowers found")
            for b in data[:5]:  # Print top 5
                print(f"   {b['name']} ({b['village']}): Pending ₹{b['total_pending']}")
        else:
            print("✅ Top borrowers working - no data (empty)")
    
    # ==================== EXPORT API ====================
    
    def test_07_export_all_accounts_excel(self):
        """Test /api/export/accounts/excel endpoint"""
        response = requests.get(f"{BASE_URL}/api/export/accounts/excel", headers=self.headers)
        assert response.status_code == 200, f"Export all accounts Excel failed: {response.text}"
        
        # Verify content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Verify content disposition
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, "Expected attachment disposition"
        assert "accounts_export.xlsx" in content_disposition, "Expected filename accounts_export.xlsx"
        
        # Verify content is not empty
        assert len(response.content) > 0, "Excel file should not be empty"
        
        print(f"✅ Export all accounts Excel working - {len(response.content)} bytes")
    
    def test_08_export_individual_account_excel(self):
        """Test /api/export/accounts/{id}/excel endpoint"""
        # First get an account ID
        accounts_response = requests.get(f"{BASE_URL}/api/accounts?limit=1", headers=self.headers)
        assert accounts_response.status_code == 200
        accounts = accounts_response.json()
        
        if accounts["total"] == 0:
            pytest.skip("No accounts to test export")
        
        account_id = accounts["accounts"][0]["id"]
        account_number = accounts["accounts"][0]["account_number"]
        
        # Export individual account
        response = requests.get(f"{BASE_URL}/api/export/accounts/{account_id}/excel", headers=self.headers)
        assert response.status_code == 200, f"Export individual account Excel failed: {response.text}"
        
        # Verify content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Verify content disposition
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, "Expected attachment disposition"
        assert "_details.xlsx" in content_disposition, "Expected filename with _details.xlsx"
        
        # Verify content is not empty
        assert len(response.content) > 0, "Excel file should not be empty"
        
        print(f"✅ Export individual account Excel working - {account_number} ({len(response.content)} bytes)")
    
    def test_09_export_individual_account_pdf(self):
        """Test /api/export/accounts/{id}/pdf endpoint"""
        # First get an account ID
        accounts_response = requests.get(f"{BASE_URL}/api/accounts?limit=1", headers=self.headers)
        assert accounts_response.status_code == 200
        accounts = accounts_response.json()
        
        if accounts["total"] == 0:
            pytest.skip("No accounts to test export")
        
        account_id = accounts["accounts"][0]["id"]
        account_number = accounts["accounts"][0]["account_number"]
        
        # Export individual account PDF
        response = requests.get(f"{BASE_URL}/api/export/accounts/{account_id}/pdf", headers=self.headers)
        assert response.status_code == 200, f"Export individual account PDF failed: {response.text}"
        
        # Verify content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF content type, got: {content_type}"
        
        # Verify content disposition
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, "Expected attachment disposition"
        assert "_details.pdf" in content_disposition, "Expected filename with _details.pdf"
        
        # Verify content is not empty and starts with PDF magic bytes
        assert len(response.content) > 0, "PDF file should not be empty"
        assert response.content[:4] == b'%PDF', "PDF should start with %PDF magic bytes"
        
        print(f"✅ Export individual account PDF working - {account_number} ({len(response.content)} bytes)")
    
    def test_10_export_nonexistent_account(self):
        """Test export endpoints with non-existent account ID"""
        fake_id = "000000000000000000000000"
        
        # Excel export
        response = requests.get(f"{BASE_URL}/api/export/accounts/{fake_id}/excel", headers=self.headers)
        assert response.status_code == 404, f"Expected 404 for non-existent account Excel export"
        
        # PDF export
        response = requests.get(f"{BASE_URL}/api/export/accounts/{fake_id}/pdf", headers=self.headers)
        assert response.status_code == 404, f"Expected 404 for non-existent account PDF export"
        
        print("✅ Export endpoints correctly return 404 for non-existent accounts")
    
    # ==================== BUG FIX VERIFICATION ====================
    
    def test_11_bug_fix_acc000025_entry2_interest_start_date(self):
        """
        Bug fix verification: Account ACC000025 Entry 2 interest_start_date = 2026-03-10
        
        Scenario:
        - Entry 1: 2026-03-01, ₹10,000
        - Entry 2: 2026-03-10, ₹2,000
        - Payment: 2026-03-06, ₹2,000
        
        Expected: Entry 2 interest_start_date = 2026-03-10 (its own date, NOT payment date)
        """
        account_id = "69b820918f6a1fd1231b5224"
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        
        if response.status_code == 404:
            pytest.skip("Account ACC000025 not found - may have been deleted")
        
        assert response.status_code == 200, f"Failed to get account: {response.text}"
        account = response.json()
        
        print(f"Account: {account.get('account_number')}")
        
        landed_entries = account.get("landed_entries", [])
        
        if len(landed_entries) >= 2:
            entry2 = landed_entries[1]
            entry2_date = entry2.get("date", "")[:10]
            entry2_interest_start = entry2.get("interest_start_date", "")[:10]
            
            print(f"Entry 2 - Date: {entry2_date}, Interest Start: {entry2_interest_start}")
            
            # Bug fix verification: Entry 2 interest_start_date should be 2026-03-10
            assert entry2_interest_start == "2026-03-10", \
                f"BUG: Entry 2 interest_start_date ({entry2_interest_start}) should be 2026-03-10"
            
            print("✅ BUG FIX VERIFIED: Entry 2 interest_start_date = 2026-03-10")
        else:
            print(f"⚠️ Account has {len(landed_entries)} landed entries, expected at least 2")
    
    # ==================== CORE FLOWS ====================
    
    def test_12_dashboard_summary(self):
        """Verify dashboard summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_landed_amount" in data
        assert "total_received_amount" in data
        assert "total_pending_amount" in data
        assert "total_pending_interest" in data
        
        print(f"✅ Dashboard summary working")
        print(f"   Total Landed: ₹{data['total_landed_amount']}")
        print(f"   Total Pending: ₹{data['total_pending_amount']}")
    
    def test_13_dashboard_stats(self):
        """Verify dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_accounts" in data
        assert "active_accounts" in data
        assert "closed_accounts" in data
        
        print(f"✅ Dashboard stats working")
        print(f"   Total: {data['total_accounts']}, Active: {data['active_accounts']}, Closed: {data['closed_accounts']}")
    
    def test_14_accounts_list(self):
        """Verify accounts list endpoint"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "accounts" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data
        
        print(f"✅ Accounts list working - {data['total']} accounts")
    
    def test_15_account_detail(self):
        """Verify account detail endpoint with enriched data"""
        # Get first account
        accounts_response = requests.get(f"{BASE_URL}/api/accounts?limit=1", headers=self.headers)
        assert accounts_response.status_code == 200
        accounts = accounts_response.json()
        
        if accounts["total"] == 0:
            pytest.skip("No accounts to test detail view")
        
        account_id = accounts["accounts"][0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert response.status_code == 200
        account = response.json()
        
        # Verify enriched data fields
        assert "total_landed_amount" in account
        assert "total_received_amount" in account
        assert "total_pending_amount" in account
        assert "total_pending_interest" in account
        assert "total_jewellery_weight" in account
        
        # Verify permission fields
        assert "user_can_edit" in account
        assert "user_can_delete" in account
        
        print(f"✅ Account detail working - {account.get('account_number')}")
    
    # ==================== AUTH REQUIRED ====================
    
    def test_16_reports_require_auth(self):
        """Verify reports endpoints require authentication"""
        endpoints = [
            "/api/reports/village-summary",
            "/api/reports/monthly-trend",
            "/api/reports/interest-rate-distribution",
            "/api/reports/top-borrowers"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], \
                f"Endpoint {endpoint} should require auth, got {response.status_code}"
        
        print("✅ All reports endpoints require authentication")
    
    def test_17_export_require_auth(self):
        """Verify export endpoints require authentication"""
        endpoints = [
            "/api/export/accounts/excel",
            "/api/export/accounts/69b820918f6a1fd1231b5224/excel",
            "/api/export/accounts/69b820918f6a1fd1231b5224/pdf"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], \
                f"Endpoint {endpoint} should require auth, got {response.status_code}"
        
        print("✅ All export endpoints require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
