#!/usr/bin/env python3
"""
LendLedger Business Logic Testing Suite
Tests specific interest calculation and payment processing scenarios
"""
import requests
import json
import sys
from datetime import datetime, date
from typing import Optional, Dict, Any

class BusinessLogicTester:
    def __init__(self, base_url: str = "https://lending-vault.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_account_id = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
            if details:
                print(f"   Details: {details}")
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

    def test_admin_login(self):
        """Test admin login with admin/admin123"""
        login_data = {"username": "admin", "password": "admin123"}
        success, data, status = self.make_request('POST', '/auth/login', login_data)
        
        if success and 'token' in data:
            self.token = data['token']
            user_info = data.get('user', {})
            self.log_test("Login with admin/admin123 credentials", True, 
                         f"User: {user_info.get('username')}, Admin: {user_info.get('is_admin')}")
        else:
            self.log_test("Login with admin/admin123 credentials", False, 
                         f"Status: {status}, Data: {data}")
        
        return success

    def test_create_account_with_landed_entry(self):
        """Create new account with landed entry dated 2026-01-01 for 100000 at 2% monthly interest"""
        account_data = {
            "opening_date": "2026-01-01",
            "name": "Business Logic Test Customer",
            "village": "Test Village BL",
            "status": "continue",
            "details": "Test account for business logic validation",
            "jewellery_items": [
                {"name": "Gold Ornament", "weight": 50.0}
            ],
            "landed_entries": [
                {
                    "date": "2026-01-01",
                    "amount": 100000.0,
                    "interest_rate": 2.0
                }
            ],
            "received_entries": []
        }
        
        success, data, status = self.make_request('POST', '/accounts', account_data, 201)
        
        if success and 'id' in data:
            self.test_account_id = data['id']
            self.log_test("Create new account with landed entry dated 2026-01-01 for 100000 at 2% monthly interest", 
                         True, 
                         f"Account ID: {data['id']}, Account Number: {data.get('account_number')}, "
                         f"Total Landed: ₹{data.get('total_landed_amount')}")
        else:
            self.log_test("Create new account with landed entry dated 2026-01-01 for 100000 at 2% monthly interest", 
                         False, f"Status: {status}, Data: {data}")
        
        return success

    def test_add_payment_entry(self):
        """Add received payment entry for 3000 dated 2026-02-15"""
        if not self.test_account_id:
            self.log_test("Add received payment entry for 3000 dated 2026-02-15", False, "No account ID available")
            return False
        
        payment_data = {
            "date": "2026-02-15",
            "amount": 3000.0
        }
        
        success, data, status = self.make_request('POST', f'/accounts/{self.test_account_id}/received', payment_data)
        
        if success:
            principal_paid = data.get('principal_paid', 0)
            interest_paid = data.get('interest_paid', 0)
            
            self.log_test("Add received payment entry for 3000 dated 2026-02-15", 
                         True, 
                         f"Principal Paid: ₹{principal_paid}, Interest Paid: ₹{interest_paid}")
        else:
            self.log_test("Add received payment entry for 3000 dated 2026-02-15", 
                         False, f"Status: {status}, Data: {data}")
        
        return success

    def test_verify_interest_calculation(self):
        """Verify interest calculation: ~45 days = 1.5 months = 100000 * 2% * 1.5 = 3000"""
        if not self.test_account_id:
            self.log_test("Verify interest calculation", False, "No account ID available")
            return False
        
        success, data, status = self.make_request('GET', f'/accounts/{self.test_account_id}')
        
        if success:
            received_entries = data.get('received_entries', [])
            if received_entries:
                # Get the first (and only) payment entry
                payment = received_entries[0]
                principal_paid = payment.get('principal_paid', 0)
                interest_paid = payment.get('interest_paid', 0)
                total_amount = payment.get('amount', 0)
                
                # Expected: 45 days from 2026-01-01 to 2026-02-15
                # 45 days ÷ 30 = 1.5 months
                # Interest = 100,000 × 2% × 1.5 = 3,000
                expected_interest = 100000 * 0.02 * 1.5  # = 3000
                
                # Allow some tolerance for calculation differences
                interest_tolerance = 100  # ±100 rupees tolerance
                interest_is_correct = abs(interest_paid - expected_interest) <= interest_tolerance
                
                # Since payment amount is exactly equal to interest, principal paid should be 0
                principal_is_correct = principal_paid == 0
                
                if interest_is_correct and principal_is_correct:
                    self.log_test("Verify interest calculation: ~45 days = 1.5 months = 100000 * 2% * 1.5 = 3000", 
                                 True, 
                                 f"Expected Interest: ₹{expected_interest}, Actual Interest: ₹{interest_paid}, "
                                 f"Principal Paid: ₹{principal_paid} (Expected: ₹0)")
                else:
                    self.log_test("Verify interest calculation: ~45 days = 1.5 months = 100000 * 2% * 1.5 = 3000", 
                                 False, 
                                 f"Expected Interest: ₹{expected_interest}, Actual Interest: ₹{interest_paid}, "
                                 f"Principal Paid: ₹{principal_paid} (Expected: ₹0). "
                                 f"Interest correct: {interest_is_correct}, Principal correct: {principal_is_correct}")
                
                return interest_is_correct and principal_is_correct
            else:
                self.log_test("Verify interest calculation", False, "No received entries found")
                return False
        else:
            self.log_test("Verify interest calculation", False, f"Status: {status}, Data: {data}")
            return False

    def test_verify_ledger_entries(self):
        """Verify ledger shows both LANDED and PAYMENT entries with correct dates"""
        if not self.test_account_id:
            self.log_test("Verify ledger shows both LANDED and PAYMENT entries", False, "No account ID available")
            return False
        
        success, data, status = self.make_request('GET', f'/ledger/{self.test_account_id}')
        
        if success and isinstance(data, list):
            # Should have exactly 2 entries: LANDED and PAYMENT
            landed_entries = [e for e in data if e.get('transaction_type') == 'LANDED']
            payment_entries = [e for e in data if e.get('transaction_type') == 'PAYMENT']
            
            has_landed = len(landed_entries) >= 1
            has_payment = len(payment_entries) >= 1
            
            if has_landed and has_payment:
                landed_date = landed_entries[0].get('transaction_date', '')[:10]  # Get date part
                payment_date = payment_entries[0].get('transaction_date', '')[:10]
                
                dates_correct = landed_date == '2026-01-01' and payment_date == '2026-02-15'
                
                if dates_correct:
                    self.log_test("Verify ledger shows both LANDED and PAYMENT entries with correct dates", 
                                 True, 
                                 f"LANDED date: {landed_date}, PAYMENT date: {payment_date}, Total entries: {len(data)}")
                else:
                    self.log_test("Verify ledger shows both LANDED and PAYMENT entries with correct dates", 
                                 False, 
                                 f"Expected LANDED: 2026-01-01, Actual: {landed_date}, "
                                 f"Expected PAYMENT: 2026-02-15, Actual: {payment_date}")
                
                return dates_correct
            else:
                self.log_test("Verify ledger shows both LANDED and PAYMENT entries with correct dates", 
                             False, 
                             f"Missing entries - LANDED: {len(landed_entries)}, PAYMENT: {len(payment_entries)}")
                return False
        else:
            self.log_test("Verify ledger shows both LANDED and PAYMENT entries", False, f"Status: {status}, Data: {data}")
            return False

    def test_verify_pending_amount_calculation(self):
        """Verify pending amount calculation is correct"""
        if not self.test_account_id:
            self.log_test("Verify pending amount calculation", False, "No account ID available")
            return False
        
        success, data, status = self.make_request('GET', f'/accounts/{self.test_account_id}')
        
        if success:
            total_landed = data.get('total_landed_amount', 0)
            total_received = data.get('total_received_amount', 0)
            received_principal = data.get('received_principal', 0)
            total_pending = data.get('total_pending_amount', 0)
            
            # Pending amount should be: Total Landed - Principal Paid
            expected_pending = total_landed - received_principal
            
            if abs(total_pending - expected_pending) < 0.01:  # Allow for floating point precision
                self.log_test("Verify pending amount calculation is correct", 
                             True, 
                             f"Total Landed: ₹{total_landed}, Principal Paid: ₹{received_principal}, "
                             f"Pending: ₹{total_pending} (Expected: ₹{expected_pending})")
            else:
                self.log_test("Verify pending amount calculation is correct", 
                             False, 
                             f"Total Landed: ₹{total_landed}, Principal Paid: ₹{received_principal}, "
                             f"Actual Pending: ₹{total_pending}, Expected Pending: ₹{expected_pending}")
            
            return abs(total_pending - expected_pending) < 0.01
        else:
            self.log_test("Verify pending amount calculation", False, f"Status: {status}, Data: {data}")
            return False

    def test_payment_larger_than_interest(self):
        """Test payment larger than interest (should reduce principal)"""
        if not self.test_account_id:
            self.log_test("Test payment larger than interest", False, "No account ID available")
            return False
        
        # Add a large payment that should cover interest and reduce principal
        payment_data = {
            "date": "2026-03-01",
            "amount": 10000.0  # This should cover remaining interest and reduce principal
        }
        
        success, data, status = self.make_request('POST', f'/accounts/{self.test_account_id}/received', payment_data)
        
        if success:
            principal_paid = data.get('principal_paid', 0)
            interest_paid = data.get('interest_paid', 0)
            
            # Since we already paid 3000 interest, there shouldn't be much interest left
            # Most of this payment should go to principal
            if principal_paid > 0 and principal_paid > interest_paid:
                self.log_test("Test payment larger than interest (should reduce principal)", 
                             True, 
                             f"Principal Paid: ₹{principal_paid}, Interest Paid: ₹{interest_paid}")
            else:
                self.log_test("Test payment larger than interest (should reduce principal)", 
                             False, 
                             f"Principal Paid: ₹{principal_paid} (should be > 0 and > interest), "
                             f"Interest Paid: ₹{interest_paid}")
            
            return principal_paid > 0 and principal_paid > interest_paid
        else:
            self.log_test("Test payment larger than interest", False, f"Status: {status}, Data: {data}")
            return False

    def cleanup_test_data(self):
        """Clean up test data"""
        if self.test_account_id:
            success, data, status = self.make_request('DELETE', f'/accounts/{self.test_account_id}')
            if success:
                print(f"✅ Cleaned up test account: {self.test_account_id}")
            else:
                print(f"⚠️  Failed to cleanup test account: {self.test_account_id}")

    def run_business_logic_tests(self):
        """Run all business logic tests"""
        print("🚀 Starting LendLedger Business Logic Tests...")
        print("=" * 70)
        
        # Test login
        print("\n🔐 Testing Authentication...")
        if not self.test_admin_login():
            print("❌ Admin login failed - cannot proceed with tests")
            return False
        
        # Create account and test scenarios
        print("\n💰 Testing Business Logic Scenarios...")
        if not self.test_create_account_with_landed_entry():
            print("❌ Account creation failed - cannot proceed with payment tests")
            return False
        
        # Test specific payment scenario
        if not self.test_add_payment_entry():
            print("❌ Payment entry failed - cannot verify calculations")
            return False
        
        # Verify calculations
        self.test_verify_interest_calculation()
        self.test_verify_ledger_entries()
        self.test_verify_pending_amount_calculation()
        
        # Additional business logic tests
        print("\n🧮 Testing Additional Payment Scenarios...")
        self.test_payment_larger_than_interest()
        
        # Cleanup
        print("\n🧹 Cleaning up test data...")
        self.cleanup_test_data()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 70)
        print("📋 BUSINESS LOGIC TEST SUMMARY")
        print("=" * 70)
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
        
        print("\n✨ Business Logic Testing completed!")
        
        return self.tests_passed == self.tests_run


def main():
    """Main function to run business logic tests"""
    tester = BusinessLogicTester()
    
    try:
        success = tester.run_business_logic_tests()
        all_passed = tester.print_summary()
        return 0 if all_passed else 1
    except Exception as e:
        print(f"❌ Testing failed with error: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())