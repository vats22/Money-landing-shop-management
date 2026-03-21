import requests
import sys
from datetime import datetime, timedelta
import json

class JewelleryLendingSystemTester:
    def __init__(self, base_url="https://loan-ledger-16.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.test_user_id = None
        self.test_account_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data.get('detail', 'Unknown error')}")
                    except:
                        print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained")
            return True
        return False

    def test_create_test_user(self):
        """Create a test user without admin rights"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "username": f"testuser_{timestamp}",
            "first_name": "Test",
            "last_name": "User",
            "mobile": f"987654{timestamp}",
            "email": f"test_{timestamp}@example.com",
            "password": "testpass123",
            "status": "active",
            "is_admin": False,
            "permissions": {}
        }
        
        success, response = self.run_test(
            "Create Test User",
            "POST",
            "api/users",
            201,
            data=user_data,
            token=self.admin_token
        )
        if success and 'id' in response:
            self.test_user_id = response['id']
            self.test_username = user_data['username']
            self.test_password = user_data['password']
            print(f"   Test user created with ID: {self.test_user_id}")
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        success, response = self.run_test(
            "Test User Login",
            "POST",
            "api/auth/login",
            200,
            data={"username": self.test_username, "password": self.test_password}
        )
        if success and 'token' in response:
            self.user_token = response['token']
            print(f"   User token obtained")
            return True
        return False

    def test_accounts_permission_denied(self):
        """Test that user without permissions cannot access accounts"""
        success, response = self.run_test(
            "Accounts Access Without Permission",
            "GET",
            "api/accounts",
            403,
            token=self.user_token
        )
        return success

    def test_assign_accounts_view_permission(self):
        """Assign accounts.view permission to test user"""
        permissions = {
            "accounts": {"view": True, "add": False, "update": False, "delete": False, "close": False},
            "users": {"view": False, "add": False, "update": False, "delete": False},
            "unlock_closed_account": False
        }
        
        success, response = self.run_test(
            "Assign Accounts View Permission",
            "PUT",
            f"api/users/{self.test_user_id}/permissions",
            200,
            data=permissions,
            token=self.admin_token
        )
        return success

    def test_accounts_access_with_permission(self):
        """Test that user with view permission can access accounts"""
        success, response = self.run_test(
            "Accounts Access With Permission",
            "GET",
            "api/accounts",
            200,
            token=self.user_token
        )
        if success:
            print(f"   User can now access accounts list")
        return success

    def test_create_account_for_testing(self):
        """Create an account for testing close/reopen functionality"""
        # Get date 30 days ago for default filter test
        past_date = (datetime.now() - timedelta(days=15)).strftime('%Y-%m-%d')
        
        account_data = {
            "opening_date": past_date,
            "name": "Test Account for Close/Reopen",
            "village": "Test Village",
            "status": "continue",
            "details": "Test account for permission testing",
            "jewellery_items": [
                {"name": "Gold Ring", "weight": 10.5}
            ],
            "landed_entries": [
                {
                    "date": past_date,
                    "amount": 50000,
                    "interest_rate": 2.0
                }
            ],
            "received_entries": []
        }
        
        success, response = self.run_test(
            "Create Test Account",
            "POST",
            "api/accounts",
            201,
            data=account_data,
            token=self.admin_token
        )
        if success and 'id' in response:
            self.test_account_id = response['id']
            print(f"   Test account created with ID: {self.test_account_id}")
            return True
        return False

    def test_close_account_permission_denied(self):
        """Test that user without close permission cannot close account"""
        close_data = {
            "close_date": datetime.now().strftime('%Y-%m-%d'),
            "remarks": "Test closure"
        }
        
        success, response = self.run_test(
            "Close Account Without Permission",
            "POST",
            f"api/accounts/{self.test_account_id}/close",
            403,
            data=close_data,
            token=self.user_token
        )
        return success

    def test_assign_close_permission(self):
        """Assign accounts.close permission to test user"""
        permissions = {
            "accounts": {"view": True, "add": False, "update": False, "delete": False, "close": True},
            "users": {"view": False, "add": False, "update": False, "delete": False},
            "unlock_closed_account": False
        }
        
        success, response = self.run_test(
            "Assign Close Permission",
            "PUT",
            f"api/users/{self.test_user_id}/permissions",
            200,
            data=permissions,
            token=self.admin_token
        )
        return success

    def test_close_account_with_permission(self):
        """Test closing account with proper permission"""
        close_data = {
            "close_date": datetime.now().strftime('%Y-%m-%d'),
            "remarks": "Test closure with permission"
        }
        
        success, response = self.run_test(
            "Close Account With Permission",
            "POST",
            f"api/accounts/{self.test_account_id}/close",
            200,
            data=close_data,
            token=self.user_token
        )
        if success:
            print(f"   Account closed successfully")
        return success

    def test_ledger_shows_closed_entry(self):
        """Test that ledger shows CLOSED entry"""
        success, response = self.run_test(
            "Verify CLOSED Ledger Entry",
            "GET",
            f"api/ledger/{self.test_account_id}",
            200,
            token=self.admin_token
        )
        if success:
            # Check if CLOSED entry exists
            closed_entries = [entry for entry in response if entry.get('transaction_type') == 'CLOSED']
            if closed_entries:
                print(f"   ✅ CLOSED ledger entry found")
                return True
            else:
                print(f"   ❌ CLOSED ledger entry not found")
                return False
        return False

    def test_reopen_without_permission(self):
        """Test that user without unlock permission cannot reopen account"""
        reopen_data = {
            "reason": "Test reopening without permission"
        }
        
        success, response = self.run_test(
            "Reopen Account Without Permission",
            "POST",
            f"api/accounts/{self.test_account_id}/reopen",
            403,
            data=reopen_data,
            token=self.user_token
        )
        return success

    def test_reopen_without_reason(self):
        """Test that reopening requires mandatory reason"""
        reopen_data = {
            "reason": ""
        }
        
        success, response = self.run_test(
            "Reopen Account Without Reason",
            "POST",
            f"api/accounts/{self.test_account_id}/reopen",
            400,
            data=reopen_data,
            token=self.admin_token
        )
        return success

    def test_assign_unlock_permission(self):
        """Assign unlock_closed_account permission to test user"""
        permissions = {
            "accounts": {"view": True, "add": False, "update": False, "delete": False, "close": True},
            "users": {"view": False, "add": False, "update": False, "delete": False},
            "unlock_closed_account": True
        }
        
        success, response = self.run_test(
            "Assign Unlock Permission",
            "PUT",
            f"api/users/{self.test_user_id}/permissions",
            200,
            data=permissions,
            token=self.admin_token
        )
        return success

    def test_reopen_account_with_permission(self):
        """Test reopening account with proper permission and reason"""
        reopen_data = {
            "reason": "Reopening for additional transactions as requested by customer"
        }
        
        success, response = self.run_test(
            "Reopen Account With Permission",
            "POST",
            f"api/accounts/{self.test_account_id}/reopen",
            200,
            data=reopen_data,
            token=self.user_token
        )
        if success:
            print(f"   Account reopened successfully")
        return success

    def test_ledger_shows_reopened_entry(self):
        """Test that ledger shows REOPENED entry"""
        success, response = self.run_test(
            "Verify REOPENED Ledger Entry",
            "GET",
            f"api/ledger/{self.test_account_id}",
            200,
            token=self.admin_token
        )
        if success:
            # Check if REOPENED entry exists
            reopened_entries = [entry for entry in response if entry.get('transaction_type') == 'REOPENED']
            if reopened_entries:
                print(f"   ✅ REOPENED ledger entry found")
                return True
            else:
                print(f"   ❌ REOPENED ledger entry not found")
                return False
        return False

    def test_villages_endpoint(self):
        """Test villages endpoint for dropdown functionality"""
        success, response = self.run_test(
            "Villages List",
            "GET",
            "api/villages",
            200,
            token=self.admin_token
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} villages")
            if "Test Village" in response:
                print(f"   ✅ Test village found in list")
            return True
        return success

    def test_accounts_with_date_filter(self):
        """Test accounts endpoint with date filter (past 30 days)"""
        # Test with past 30 days filter
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        end_date = datetime.now().strftime('%Y-%m-%d')
        
        success, response = self.run_test(
            "Accounts with Date Filter (Past 30 Days)",
            "GET",
            f"api/accounts?start_date={start_date}&end_date={end_date}",
            200,
            token=self.admin_token
        )
        if success:
            accounts = response.get('accounts', [])
            print(f"   Found {len(accounts)} accounts in past 30 days")
            return True
        return success

    def test_inactive_user_auto_logout(self):
        """Test that inactive users are automatically logged out"""
        # First, deactivate the test user
        success, response = self.run_test(
            "Deactivate Test User",
            "PUT",
            f"api/users/{self.test_user_id}/status",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Try to access accounts with inactive user token
        success, response = self.run_test(
            "Access with Inactive User Token",
            "GET",
            "api/accounts",
            403,  # Should be forbidden due to inactive status
            token=self.user_token
        )
        return success

    def cleanup(self):
        """Clean up test data"""
        if self.test_account_id:
            self.run_test(
                "Cleanup Test Account",
                "DELETE",
                f"api/accounts/{self.test_account_id}",
                200,
                token=self.admin_token
            )
        
        if self.test_user_id:
            self.run_test(
                "Cleanup Test User",
                "DELETE",
                f"api/users/{self.test_user_id}",
                200,
                token=self.admin_token
            )

def main():
    print("🚀 Starting Jewellery Lending System Permission Testing...")
    tester = JewelleryLendingSystemTester()
    
    try:
        # Authentication Tests
        if not tester.test_admin_login():
            print("❌ Admin login failed, stopping tests")
            return 1
        
        # User Management and Permission Tests
        if not tester.test_create_test_user():
            print("❌ Test user creation failed")
            return 1
        
        if not tester.test_user_login():
            print("❌ Test user login failed")
            return 1
        
        # Permission-based Access Control Tests
        if not tester.test_accounts_permission_denied():
            print("❌ Permission denial test failed")
            return 1
        
        if not tester.test_assign_accounts_view_permission():
            print("❌ Permission assignment failed")
            return 1
        
        if not tester.test_accounts_access_with_permission():
            print("❌ Access with permission failed")
            return 1
        
        # Account Creation for Testing
        if not tester.test_create_account_for_testing():
            print("❌ Test account creation failed")
            return 1
        
        # Close Account Permission Tests
        if not tester.test_close_account_permission_denied():
            print("❌ Close permission denial test failed")
            return 1
        
        if not tester.test_assign_close_permission():
            print("❌ Close permission assignment failed")
            return 1
        
        if not tester.test_close_account_with_permission():
            print("❌ Close account test failed")
            return 1
        
        if not tester.test_ledger_shows_closed_entry():
            print("❌ CLOSED ledger entry test failed")
            return 1
        
        # Reopen Account Permission Tests
        if not tester.test_reopen_without_permission():
            print("❌ Reopen permission denial test failed")
            return 1
        
        if not tester.test_reopen_without_reason():
            print("❌ Mandatory reason test failed")
            return 1
        
        if not tester.test_assign_unlock_permission():
            print("❌ Unlock permission assignment failed")
            return 1
        
        if not tester.test_reopen_account_with_permission():
            print("❌ Reopen account test failed")
            return 1
        
        if not tester.test_ledger_shows_reopened_entry():
            print("❌ REOPENED ledger entry test failed")
            return 1
        
        # Additional Feature Tests
        if not tester.test_villages_endpoint():
            print("❌ Villages endpoint test failed")
            return 1
        
        if not tester.test_accounts_with_date_filter():
            print("❌ Date filter test failed")
            return 1
        
        if not tester.test_inactive_user_auto_logout():
            print("❌ Inactive user auto-logout test failed")
            return 1
        
        # Print results
        print(f"\n📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
        print(f"✅ Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        
        if tester.tests_passed == tester.tests_run:
            print("\n🎉 All permission-based features working correctly!")
            return 0
        else:
            print(f"\n⚠️  {tester.tests_run - tester.tests_passed} tests failed")
            return 1
    
    finally:
        # Cleanup
        print("\n🧹 Cleaning up test data...")
        tester.cleanup()

if __name__ == "__main__":
    sys.exit(main())