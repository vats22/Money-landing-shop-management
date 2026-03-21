#!/usr/bin/env python3
"""
Additional Business Logic Test: Multiple Landed Entries with Different Interest Rates
"""
import requests
import json
import sys
from datetime import datetime, date

class MultipleEntriesTester:
    def __init__(self, base_url: str = "https://pawn-mgmt.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.token = None
        self.test_account_id = None

    def make_request(self, method: str, endpoint: str, data: dict = None, expected_status: int = 200) -> tuple:
        """Make API request"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}
            
            return success, response_data, response.status_code
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_login(self):
        """Login as admin"""
        login_data = {"username": "admin", "password": "admin123"}
        success, data, status = self.make_request('POST', '/auth/login', login_data)
        
        if success and 'token' in data:
            self.token = data['token']
            print("✅ Logged in successfully")
            return True
        else:
            print(f"❌ Login failed: {data}")
            return False

    def test_multiple_landed_entries_different_rates(self):
        """Test multiple landed entries with different interest rates"""
        print("\n🧮 Testing Multiple Landed Entries with Different Interest Rates...")
        
        account_data = {
            "opening_date": "2026-01-01",
            "name": "Multiple Entries Test",
            "village": "Multiple Test Village",
            "status": "continue",
            "details": "Testing multiple landed entries with different rates",
            "jewellery_items": [
                {"name": "Gold Items", "weight": 100.0}
            ],
            "landed_entries": [
                {
                    "date": "2026-01-01",
                    "amount": 50000.0,
                    "interest_rate": 2.0  # 2% monthly
                },
                {
                    "date": "2026-01-15", 
                    "amount": 30000.0,
                    "interest_rate": 3.0  # 3% monthly
                }
            ],
            "received_entries": []
        }
        
        success, data, status = self.make_request('POST', '/accounts', account_data, 201)
        
        if success and 'id' in data:
            self.test_account_id = data['id']
            print(f"✅ Created account with multiple landed entries")
            print(f"   - Entry 1: ₹50,000 at 2% from 2026-01-01")
            print(f"   - Entry 2: ₹30,000 at 3% from 2026-01-15")
            print(f"   - Total Landed: ₹{data.get('total_landed_amount')}")
            return True
        else:
            print(f"❌ Failed to create account: {data}")
            return False

    def test_payment_distribution_multiple_entries(self):
        """Test payment distribution across multiple entries with different rates"""
        if not self.test_account_id:
            print("❌ No account ID available")
            return False
        
        print("\n💰 Testing Payment Distribution Across Multiple Entries...")
        
        # Make a large payment that should pay interest on both entries and reduce principal
        payment_data = {
            "date": "2026-02-15",  # ~45 days from first entry, ~30 days from second
            "amount": 10000.0      # Should cover interest and reduce principal
        }
        
        success, data, status = self.make_request('POST', f'/accounts/{self.test_account_id}/received', payment_data)
        
        if success:
            principal_paid = data.get('principal_paid', 0)
            interest_paid = data.get('interest_paid', 0)
            
            print(f"✅ Payment processed successfully")
            print(f"   - Payment Amount: ₹10,000")
            print(f"   - Interest Paid: ₹{interest_paid}")
            print(f"   - Principal Paid: ₹{principal_paid}")
            
            # Verify the account details after payment
            success, account_data, status = self.make_request('GET', f'/accounts/{self.test_account_id}')
            
            if success:
                print(f"\n📊 Account Summary After Payment:")
                print(f"   - Total Landed: ₹{account_data.get('total_landed_amount')}")
                print(f"   - Total Received: ₹{account_data.get('total_received_amount')}")  
                print(f"   - Total Principal Paid: ₹{account_data.get('received_principal')}")
                print(f"   - Total Interest Paid: ₹{account_data.get('received_interest')}")
                print(f"   - Pending Amount: ₹{account_data.get('total_pending_amount')}")
                print(f"   - Pending Interest: ₹{account_data.get('total_pending_interest')}")
                
                # Check individual landed entries for remaining principal
                landed_entries = account_data.get('landed_entries', [])
                print(f"\n🏦 Landed Entries After Payment:")
                for i, entry in enumerate(landed_entries):
                    remaining = entry.get('remaining_principal', 0)
                    original = entry.get('amount', 0)
                    paid_principal = original - remaining
                    rate = entry.get('interest_rate', 0)
                    print(f"   Entry {i+1}: ₹{original} at {rate}% → ₹{remaining} remaining (₹{paid_principal} paid)")
                
                return True
            else:
                print(f"❌ Failed to get updated account data: {account_data}")
                return False
        else:
            print(f"❌ Payment failed: {data}")
            return False

    def cleanup(self):
        """Clean up test data"""
        if self.test_account_id:
            success, data, status = self.make_request('DELETE', f'/accounts/{self.test_account_id}')
            if success:
                print(f"✅ Cleaned up test account: {self.test_account_id}")
            else:
                print(f"⚠️  Failed to cleanup: {data}")

    def run_test(self):
        """Run the multiple entries test"""
        print("🚀 Testing Multiple Landed Entries with Different Interest Rates...")
        print("=" * 80)
        
        if not self.test_login():
            return False
        
        if not self.test_multiple_landed_entries_different_rates():
            return False
        
        if not self.test_payment_distribution_multiple_entries():
            return False
        
        self.cleanup()
        
        print("\n✨ Multiple entries test completed successfully!")
        return True

def main():
    tester = MultipleEntriesTester()
    success = tester.run_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())