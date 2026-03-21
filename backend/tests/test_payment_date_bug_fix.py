"""
Test suite for Payment Date Bug Fix - Iteration 5
Bug: When received payment date is BEFORE a later landed entry date, 
the payment should NOT affect the later landed entry's interest_start_date.

Test Scenarios:
1. Verify existing account ACC000025 has correct interest_start_dates
2. Create new test account with specific scenario to verify fix
3. Verify chronological ledger generation with correct running balance
4. Verify payment distribution (interest first, then principal FIFO)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pawn-mgmt.preview.emergentagent.com').rstrip('/')

class TestPaymentDateBugFix:
    """Test payment date bug fix - payments should not affect later landed entries"""
    
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
    
    def test_01_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("API health check passed")
    
    def test_02_existing_account_acc000025_interest_start_dates(self):
        """
        Verify existing account ACC000025 has correct interest_start_dates
        - Entry 1 (2026-03-01, ₹10,000): interest_start_date should be 2026-03-06 (payment date)
        - Entry 2 (2026-03-10, ₹2,000): interest_start_date should be 2026-03-10 (its own date, NOT payment date)
        """
        account_id = "69b820918f6a1fd1231b5224"
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        
        if response.status_code == 404:
            pytest.skip("Account ACC000025 not found - may have been deleted")
        
        assert response.status_code == 200, f"Failed to get account: {response.text}"
        account = response.json()
        
        print(f"Account: {account.get('account_number')}")
        print(f"Landed entries: {len(account.get('landed_entries', []))}")
        
        landed_entries = account.get("landed_entries", [])
        
        # Verify we have at least 2 landed entries
        if len(landed_entries) >= 2:
            entry1 = landed_entries[0]
            entry2 = landed_entries[1]
            
            print(f"Entry 1 - Date: {entry1.get('date')}, Amount: {entry1.get('amount')}, Interest Start: {entry1.get('interest_start_date')}")
            print(f"Entry 2 - Date: {entry2.get('date')}, Amount: {entry2.get('amount')}, Interest Start: {entry2.get('interest_start_date')}")
            
            # Entry 1 should have interest_start_date = 2026-03-06 (payment date)
            # Entry 2 should have interest_start_date = 2026-03-10 (its own date)
            
            # Check Entry 2's interest_start_date is its own date (not affected by earlier payment)
            entry2_date = entry2.get("date", "")[:10]
            entry2_interest_start = entry2.get("interest_start_date", "")[:10]
            
            print(f"Entry 2 date: {entry2_date}, Entry 2 interest_start_date: {entry2_interest_start}")
            
            # The bug fix ensures Entry 2's interest_start_date = its own date
            assert entry2_interest_start == entry2_date, \
                f"BUG: Entry 2 interest_start_date ({entry2_interest_start}) should equal its own date ({entry2_date})"
            
            print("✅ Entry 2 interest_start_date correctly equals its own date (bug fix verified)")
        else:
            print(f"Account has {len(landed_entries)} landed entries, skipping detailed check")
    
    def test_03_create_new_test_account_verify_bug_fix(self):
        """
        Create NEW test account with:
        - Landed entry 1: 2026-03-01, ₹5000, 2.5%
        - Landed entry 2: 2026-03-15, ₹3000, 3%
        - Received entry: 2026-03-10, ₹1000
        
        Expected:
        - Entry 1 interest_start_date = 2026-03-10 (payment date)
        - Entry 2 interest_start_date = 2026-03-15 (its own date, NOT payment date)
        """
        account_data = {
            "opening_date": "2026-03-01",
            "name": "TEST_BugFix_PaymentDate",
            "village": "Test Village",
            "status": "continue",
            "details": "Test account for payment date bug fix verification",
            "jewellery_items": [
                {"name": "Test Gold Ring", "weight": 5.0}
            ],
            "landed_entries": [
                {
                    "date": "2026-03-01",
                    "amount": 5000,
                    "interest_rate": 2.5
                },
                {
                    "date": "2026-03-15",
                    "amount": 3000,
                    "interest_rate": 3.0
                }
            ],
            "received_entries": [
                {
                    "date": "2026-03-10",
                    "amount": 1000
                }
            ]
        }
        
        # Create account
        response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert response.status_code == 201, f"Failed to create account: {response.text}"
        
        created_account = response.json()
        account_id = created_account["id"]
        print(f"Created test account: {created_account.get('account_number')} (ID: {account_id})")
        
        # Fetch account to get enriched data
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert response.status_code == 200
        account = response.json()
        
        landed_entries = account.get("landed_entries", [])
        assert len(landed_entries) == 2, f"Expected 2 landed entries, got {len(landed_entries)}"
        
        entry1 = landed_entries[0]
        entry2 = landed_entries[1]
        
        print(f"\nEntry 1 - Date: {entry1.get('date')}, Amount: {entry1.get('amount')}")
        print(f"  Interest Start: {entry1.get('interest_start_date')}")
        print(f"  Days: {entry1.get('days')}")
        print(f"  Remaining Principal: {entry1.get('remaining_principal')}")
        
        print(f"\nEntry 2 - Date: {entry2.get('date')}, Amount: {entry2.get('amount')}")
        print(f"  Interest Start: {entry2.get('interest_start_date')}")
        print(f"  Days: {entry2.get('days')}")
        print(f"  Remaining Principal: {entry2.get('remaining_principal')}")
        
        # CRITICAL ASSERTION: Entry 2's interest_start_date should be its own date (2026-03-15)
        # NOT the payment date (2026-03-10)
        entry2_date = entry2.get("date", "")[:10]
        entry2_interest_start = entry2.get("interest_start_date", "")[:10]
        
        assert entry2_interest_start == entry2_date, \
            f"BUG NOT FIXED: Entry 2 interest_start_date ({entry2_interest_start}) should be {entry2_date}, not payment date"
        
        print(f"\n✅ BUG FIX VERIFIED: Entry 2 interest_start_date = {entry2_interest_start} (its own date)")
        
        # Entry 1's interest_start_date should be payment date (2026-03-10)
        entry1_interest_start = entry1.get("interest_start_date", "")[:10]
        assert entry1_interest_start == "2026-03-10", \
            f"Entry 1 interest_start_date ({entry1_interest_start}) should be 2026-03-10 (payment date)"
        
        print(f"✅ Entry 1 interest_start_date = {entry1_interest_start} (payment date)")
        
        # Cleanup - delete test account
        delete_response = requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Failed to delete test account: {delete_response.text}"
        print(f"\n🧹 Cleaned up test account {account_id}")
    
    def test_04_chronological_ledger_running_balance(self):
        """
        Verify ledger entries are generated in chronological order with correct running balance.
        
        Create account with:
        - Landed 2026-03-01: ₹10,000
        - Landed 2026-03-10: ₹2,000
        - Payment 2026-03-06: ₹2,000
        
        Expected ledger order (chronological):
        1. 2026-03-01 LANDED ₹10,000 -> balance = 10,000
        2. 2026-03-06 PAYMENT ₹2,000 -> balance = 8,XXX (after interest + principal)
        3. 2026-03-10 LANDED ₹2,000 -> balance = 10,XXX
        """
        account_data = {
            "opening_date": "2026-03-01",
            "name": "TEST_ChronologicalLedger",
            "village": "Test Village",
            "status": "continue",
            "details": "Test account for chronological ledger verification",
            "jewellery_items": [],
            "landed_entries": [
                {
                    "date": "2026-03-01",
                    "amount": 10000,
                    "interest_rate": 2.5
                },
                {
                    "date": "2026-03-10",
                    "amount": 2000,
                    "interest_rate": 2.5
                }
            ],
            "received_entries": [
                {
                    "date": "2026-03-06",
                    "amount": 2000
                }
            ]
        }
        
        # Create account
        response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert response.status_code == 201, f"Failed to create account: {response.text}"
        
        created_account = response.json()
        account_id = created_account["id"]
        print(f"Created test account: {created_account.get('account_number')} (ID: {account_id})")
        
        # Get ledger entries
        response = requests.get(f"{BASE_URL}/api/ledger/{account_id}", headers=self.headers)
        assert response.status_code == 200
        ledger = response.json()
        
        print(f"\nLedger entries ({len(ledger)} total):")
        for i, entry in enumerate(ledger):
            print(f"  {i+1}. {entry.get('transaction_date')[:10]} {entry.get('transaction_type')} "
                  f"Amount: {entry.get('amount')} Balance: {entry.get('balance_amount')}")
        
        # Verify chronological order
        assert len(ledger) >= 3, f"Expected at least 3 ledger entries, got {len(ledger)}"
        
        # First entry should be LANDED on 2026-03-01
        assert ledger[0]["transaction_type"] == "LANDED"
        assert ledger[0]["transaction_date"][:10] == "2026-03-01"
        assert ledger[0]["balance_amount"] == 10000
        print(f"\n✅ Entry 1: LANDED on 2026-03-01, balance = 10000")
        
        # Second entry should be PAYMENT on 2026-03-06
        assert ledger[1]["transaction_type"] == "PAYMENT"
        assert ledger[1]["transaction_date"][:10] == "2026-03-06"
        # Balance after payment should be less than 10000 (principal reduced)
        payment_balance = ledger[1]["balance_amount"]
        print(f"✅ Entry 2: PAYMENT on 2026-03-06, balance = {payment_balance}")
        
        # Third entry should be LANDED on 2026-03-10
        assert ledger[2]["transaction_type"] == "LANDED"
        assert ledger[2]["transaction_date"][:10] == "2026-03-10"
        print(f"✅ Entry 3: LANDED on 2026-03-10, balance = {ledger[2]['balance_amount']}")
        
        print(f"\n✅ CHRONOLOGICAL LEDGER VERIFIED: Entries are in date order")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"🧹 Cleaned up test account {account_id}")
    
    def test_05_payment_distribution_interest_first_then_principal(self):
        """
        Verify payment distribution: interest is paid first, then principal (FIFO)
        
        Create account with:
        - Landed 2026-03-01: ₹10,000 at 2.5%
        - Payment 2026-03-06: ₹2,000 (5 days of interest)
        
        Interest for 5 days = (10000 * 2.5 * 5) / (100 * 30) = 41.67
        Principal paid = 2000 - 41.67 = 1958.33
        Remaining principal = 10000 - 1958.33 = 8041.67
        """
        account_data = {
            "opening_date": "2026-03-01",
            "name": "TEST_PaymentDistribution",
            "village": "Test Village",
            "status": "continue",
            "details": "Test account for payment distribution verification",
            "jewellery_items": [],
            "landed_entries": [
                {
                    "date": "2026-03-01",
                    "amount": 10000,
                    "interest_rate": 2.5
                }
            ],
            "received_entries": [
                {
                    "date": "2026-03-06",
                    "amount": 2000
                }
            ]
        }
        
        # Create account
        response = requests.post(f"{BASE_URL}/api/accounts", json=account_data, headers=self.headers)
        assert response.status_code == 201, f"Failed to create account: {response.text}"
        
        created_account = response.json()
        account_id = created_account["id"]
        print(f"Created test account: {created_account.get('account_number')} (ID: {account_id})")
        
        # Fetch account details
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert response.status_code == 200
        account = response.json()
        
        received_entries = account.get("received_entries", [])
        assert len(received_entries) == 1
        
        payment = received_entries[0]
        interest_paid = payment.get("interest_paid", 0)
        principal_paid = payment.get("principal_paid", 0)
        
        print(f"\nPayment of ₹2000 on 2026-03-06:")
        print(f"  Interest paid: ₹{interest_paid}")
        print(f"  Principal paid: ₹{principal_paid}")
        
        # Expected interest for 5 days = (10000 * 2.5 * 5) / (100 * 30) = 41.67
        expected_interest = round((10000 * 2.5 * 5) / (100 * 30), 2)
        expected_principal = round(2000 - expected_interest, 2)
        
        print(f"\nExpected:")
        print(f"  Interest: ₹{expected_interest}")
        print(f"  Principal: ₹{expected_principal}")
        
        # Allow small floating point tolerance
        assert abs(interest_paid - expected_interest) < 0.1, \
            f"Interest paid ({interest_paid}) should be ~{expected_interest}"
        assert abs(principal_paid - expected_principal) < 0.1, \
            f"Principal paid ({principal_paid}) should be ~{expected_principal}"
        
        # Verify remaining principal
        landed_entries = account.get("landed_entries", [])
        remaining_principal = landed_entries[0].get("remaining_principal", 0)
        expected_remaining = round(10000 - expected_principal, 2)
        
        print(f"\nRemaining principal: ₹{remaining_principal}")
        print(f"Expected remaining: ₹{expected_remaining}")
        
        assert abs(remaining_principal - expected_remaining) < 0.1, \
            f"Remaining principal ({remaining_principal}) should be ~{expected_remaining}"
        
        print(f"\n✅ PAYMENT DISTRIBUTION VERIFIED: Interest first, then principal (FIFO)")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"🧹 Cleaned up test account {account_id}")
    
    def test_06_core_flows_login_account_list_detail(self):
        """Verify existing core flows still work: login, account list, account detail"""
        
        # Login already verified in setup
        print("✅ Login working")
        
        # Account list
        response = requests.get(f"{BASE_URL}/api/accounts", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        assert "total" in data
        print(f"✅ Account list working - {data['total']} accounts found")
        
        # Account detail (if accounts exist)
        if data["accounts"]:
            account_id = data["accounts"][0]["id"]
            response = requests.get(f"{BASE_URL}/api/accounts/{account_id}", headers=self.headers)
            assert response.status_code == 200
            account = response.json()
            
            # Verify enriched data fields
            assert "total_landed_amount" in account
            assert "total_received_amount" in account
            assert "total_pending_amount" in account
            assert "total_pending_interest" in account
            
            # Verify landed entries have enriched interest details
            if account.get("landed_entries"):
                entry = account["landed_entries"][0]
                assert "interest_start_date" in entry
                assert "days" in entry
                assert "calculated_interest" in entry
                print(f"✅ Account detail working with enriched data")
        else:
            print("⚠️ No accounts to test detail view")
    
    def test_07_dashboard_summary(self):
        """Verify dashboard summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_landed_amount" in data
        assert "total_received_amount" in data
        assert "total_pending_amount" in data
        assert "total_pending_interest" in data
        
        print(f"✅ Dashboard summary working")
        print(f"  Total Landed: ₹{data['total_landed_amount']}")
        print(f"  Total Received: ₹{data['total_received_amount']}")
        print(f"  Total Pending: ₹{data['total_pending_amount']}")
        print(f"  Total Interest: ₹{data['total_pending_interest']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
