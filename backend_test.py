#!/usr/bin/env python3
"""
LendLedger Backend API Testing Suite
Tests all endpoints for the Jewellery & Money Lending Management System
"""
import requests
import json
import sys
from datetime import datetime, date
from typing import Optional, Dict, Any

class LendLedgerAPITester:
    def __init__(self, base_url: str = "https://71b2ff06-e750-4d79-b6ec-a0f83b706389.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_account_id = None
        self.created_user_id = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {details}")
        
        self.test_results.append({
            "test": name,
            "status": "PASSED" if success else "FAILED",
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200) -> tuple:
        """Make API request and return success, response data"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}
            
            return success, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_health_check(self):
        """Test health endpoint"""
        success, data, status = self.make_request('GET', '/health')
        self.log_test("Health Check", success, 
                     f"Status: {status}" if not success else "", data)
        return success

    def test_admin_login(self, username: str = "admin", password: str = "admin123"):
        """Test admin login"""
        login_data = {"username": username, "password": password}
        success, data, status = self.make_request('POST', '/auth/login', login_data)
        
        if success and 'token' in data:
            self.token = data['token']
            self.log_test("Admin Login", True, "", {"user": data.get('user', {}).get('username')})
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Data: {data}")
        
        return success

    def test_get_current_user(self):
        """Test getting current user info"""
        success, data, status = self.make_request('GET', '/auth/me')
        self.log_test("Get Current User", success, 
                     f"Status: {status}" if not success else "", 
                     {"username": data.get('username')} if success else data)
        return success

    def test_dashboard_summary(self):
        """Test dashboard summary endpoint"""
        success, data, status = self.make_request('GET', '/dashboard/summary')
        
        if success:
            required_fields = ['total_landed_amount', 'total_received_amount', 
                             'total_pending_amount', 'total_pending_interest']
            has_all_fields = all(field in data for field in required_fields)
            if has_all_fields:
                self.log_test("Dashboard Summary", True, "", 
                            {k: data.get(k) for k in required_fields})
            else:
                missing_fields = [f for f in required_fields if f not in data]
                self.log_test("Dashboard Summary", False, 
                            f"Missing fields: {missing_fields}", data)
        else:
            self.log_test("Dashboard Summary", False, f"Status: {status}", data)
        
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, data, status = self.make_request('GET', '/dashboard/stats')
        
        if success:
            required_fields = ['total_accounts', 'active_accounts', 'closed_accounts']
            has_all_fields = all(field in data for field in required_fields)
            if has_all_fields:
                self.log_test("Dashboard Stats", True, "", 
                            {k: data.get(k) for k in required_fields})
            else:
                missing_fields = [f for f in required_fields if f not in data]
                self.log_test("Dashboard Stats", False, 
                            f"Missing fields: {missing_fields}", data)
        else:
            self.log_test("Dashboard Stats", False, f"Status: {status}", data)
        
        return success

    def test_create_account(self):
        """Test creating a new account"""
        account_data = {
            "opening_date": date.today().isoformat(),
            "name": "Test Customer",
            "village": "Test Village",
            "status": "continue",
            "details": "Test account for API testing",
            "jewellery_items": [
                {"name": "Gold Ring", "weight": 10.5},
                {"name": "Gold Necklace", "weight": 25.0}
            ],
            "landed_entries": [
                {
                    "date": date.today().isoformat(),
                    "amount": 50000.0,
                    "interest_rate": 2.0
                }
            ],
            "received_entries": []
        }
        
        success, data, status = self.make_request('POST', '/accounts', account_data, 201)
        
        if success and 'id' in data:
            self.created_account_id = data['id']
            self.log_test("Create Account", True, "", 
                        {"id": data['id'], "account_number": data.get('account_number')})
        else:
            self.log_test("Create Account", False, f"Status: {status}", data)
        
        return success

    def test_get_accounts_list(self):
        """Test getting accounts list"""
        success, data, status = self.make_request('GET', '/accounts')
        
        if success:
            required_fields = ['accounts', 'total', 'page', 'limit', 'total_pages']
            has_all_fields = all(field in data for field in required_fields)
            if has_all_fields:
                self.log_test("Get Accounts List", True, "", 
                            {"total": data.get('total'), "page": data.get('page')})
            else:
                missing_fields = [f for f in required_fields if f not in data]
                self.log_test("Get Accounts List", False, 
                            f"Missing fields: {missing_fields}", data)
        else:
            self.log_test("Get Accounts List", False, f"Status: {status}", data)
        
        return success

    def test_get_account_detail(self):
        """Test getting account details"""
        if not self.created_account_id:
            self.log_test("Get Account Detail", False, "No account ID available")
            return False
        
        success, data, status = self.make_request('GET', f'/accounts/{self.created_account_id}')
        
        if success:
            required_fields = ['id', 'name', 'village', 'jewellery_items', 'landed_entries']
            has_all_fields = all(field in data for field in required_fields)
            if has_all_fields:
                self.log_test("Get Account Detail", True, "", 
                            {"name": data.get('name'), "total_landed_amount": data.get('total_landed_amount')})
            else:
                missing_fields = [f for f in required_fields if f not in data]
                self.log_test("Get Account Detail", False, 
                            f"Missing fields: {missing_fields}", data)
        else:
            self.log_test("Get Account Detail", False, f"Status: {status}", data)
        
        return success

    def test_update_account(self):
        """Test updating an account"""
        if not self.created_account_id:
            self.log_test("Update Account", False, "No account ID available")
            return False
        
        update_data = {
            "name": "Updated Test Customer",
            "details": "Updated details for testing"
        }
        
        success, data, status = self.make_request('PUT', f'/accounts/{self.created_account_id}', update_data)
        
        if success and data.get('name') == "Updated Test Customer":
            self.log_test("Update Account", True, "", {"name": data.get('name')})
        else:
            self.log_test("Update Account", False, f"Status: {status}", data)
        
        return success

    def test_add_received_entry(self):
        """Test adding a received payment entry"""
        if not self.created_account_id:
            self.log_test("Add Received Entry", False, "No account ID available")
            return False
        
        payment_data = {
            "date": date.today().isoformat(),
            "amount": 5000.0
        }
        
        success, data, status = self.make_request('POST', f'/accounts/{self.created_account_id}/received', payment_data)
        
        if success:
            self.log_test("Add Received Entry", True, "", 
                        {"principal_paid": data.get('principal_paid'), "interest_paid": data.get('interest_paid')})
        else:
            self.log_test("Add Received Entry", False, f"Status: {status}", data)
        
        return success

    def test_get_account_ledger(self):
        """Test getting account ledger"""
        if not self.created_account_id:
            self.log_test("Get Account Ledger", False, "No account ID available")
            return False
        
        success, data, status = self.make_request('GET', f'/ledger/{self.created_account_id}')
        
        if success:
            entries_count = len(data) if isinstance(data, list) else 0
            self.log_test("Get Account Ledger", True, "", {"entries": entries_count})
        else:
            self.log_test("Get Account Ledger", False, f"Status: {status}", data)
        
        return success

    def test_get_villages(self):
        """Test getting villages list"""
        success, data, status = self.make_request('GET', '/villages')
        
        if success and isinstance(data, list):
            self.log_test("Get Villages", True, "", {"count": len(data)})
        else:
            self.log_test("Get Villages", False, f"Status: {status}", data)
        
        return success

    def test_get_users(self):
        """Test getting users list (admin only)"""
        success, data, status = self.make_request('GET', '/users')
        
        if success and isinstance(data, list):
            self.log_test("Get Users", True, "", {"count": len(data)})
        else:
            self.log_test("Get Users", False, f"Status: {status}", data)
        
        return success

    def test_create_user(self):
        """Test creating a new user"""
        # Use timestamp to make username unique
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "username": f"testuser{timestamp}",
            "first_name": "Test",
            "last_name": "User",
            "mobile": f"987654{timestamp[-4:]}",
            "email": f"test{timestamp}@example.com",
            "password": "testpass123",
            "status": "active",
            "is_admin": False,
            "permissions": {}
        }
        
        success, data, status = self.make_request('POST', '/users', user_data, 201)
        
        if success and 'id' in data:
            self.created_user_id = data['id']
            self.log_test("Create User", True, "", 
                        {"id": data['id'], "username": data.get('username')})
        else:
            self.log_test("Create User", False, f"Status: {status}", data)
        
        return success

    def test_update_user_permissions(self):
        """Test updating user permissions"""
        if not self.created_user_id:
            self.log_test("Update User Permissions", False, "No user ID available")
            return False
        
        permissions = {
            "accounts": {"view": True, "add": False, "update": False, "delete": False},
            "users": {"view": False, "add": False, "update": False, "delete": False},
            "unlock_closed_account": False
        }
        
        success, data, status = self.make_request('PUT', f'/users/{self.created_user_id}/permissions', permissions)
        
        if success:
            self.log_test("Update User Permissions", True, "", {"message": data.get('message')})
        else:
            self.log_test("Update User Permissions", False, f"Status: {status}", data)
        
        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        cleanup_success = True
        
        # Delete test account
        if self.created_account_id:
            success, data, status = self.make_request('DELETE', f'/accounts/{self.created_account_id}')
            if success:
                print(f"✅ Cleaned up test account: {self.created_account_id}")
            else:
                print(f"⚠️  Failed to cleanup test account: {self.created_account_id}")
                cleanup_success = False
        
        # Delete test user
        if self.created_user_id:
            success, data, status = self.make_request('DELETE', f'/users/{self.created_user_id}')
            if success:
                print(f"✅ Cleaned up test user: {self.created_user_id}")
            else:
                print(f"⚠️  Failed to cleanup test user: {self.created_user_id}")
                cleanup_success = False
        
        return cleanup_success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting LendLedger Backend API Tests...")
        print("=" * 60)
        
        # Basic connectivity and auth tests
        print("\n📡 Testing Basic Connectivity...")
        if not self.test_health_check():
            print("❌ Health check failed - backend might be down")
            return False
        
        if not self.test_admin_login():
            print("❌ Admin login failed - cannot proceed with authenticated tests")
            return False
        
        self.test_get_current_user()
        
        # Dashboard tests
        print("\n📊 Testing Dashboard Endpoints...")
        self.test_dashboard_summary()
        self.test_dashboard_stats()
        
        # Account management tests
        print("\n💼 Testing Account Management...")
        self.test_get_accounts_list()
        if self.test_create_account():
            self.test_get_account_detail()
            self.test_update_account()
            self.test_add_received_entry()
            self.test_get_account_ledger()
        
        # Data lookup tests
        print("\n🔍 Testing Data Lookups...")
        self.test_get_villages()
        
        # User management tests (admin only)
        print("\n👥 Testing User Management...")
        self.test_get_users()
        if self.test_create_user():
            self.test_update_user_permissions()
        
        # Cleanup
        print("\n🧹 Cleaning up test data...")
        self.cleanup_test_data()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0%")
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if r['status'] == 'FAILED']
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        print("\n✨ Testing completed!")
        
        return self.tests_passed == self.tests_run


def main():
    """Main function to run tests"""
    tester = LendLedgerAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Testing failed with error: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())