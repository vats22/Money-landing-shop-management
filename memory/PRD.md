# LendLedger - Jewellery & Money Lending Management System

## Original Problem Statement
Build a full-stack Jewellery & Money Lending Management Web Application with:
- Multiple jewellery items per account
- Multiple lending entries per account
- Multiple received payment entries per account
- Date-wise interest calculation (monthly)
- Ledger-based financial tracking
- Role-based user permissions

## User Personas
1. **Master Admin** - Full system access, manages users and permissions
2. **Regular Users** - Access based on assigned permissions (operator, viewer)

## Technology Stack
- **Frontend**: React 18, Tailwind CSS, React Router, Recharts
- **Backend**: Python FastAPI (modular structure with APIRouter)
- **Database**: MongoDB (Motor async driver)
- **Auth**: JWT Authentication with bcrypt password hashing

## Core Requirements
- [x] Login with username/mobile + password (no signup)
- [x] Dashboard with 4 summary cards + stats
- [x] Accounts management with full CRUD
- [x] Jewellery items tracking per account
- [x] Landed entries (money lent) with interest rates
- [x] Received entries (payments) with automatic distribution
- [x] Ledger system for audit trail (chronological)
- [x] User management (Admin only)
- [x] Permission system per module
- [x] Close/Reopen account lifecycle
- [x] Reports & Analytics Dashboard
- [x] Export to PDF/Excel

## Architecture (Post-Refactoring)
```
/app/backend/
  server.py          - Main app, CORS, startup, router registration
  config.py          - Settings, DB connection, collections
  auth.py            - JWT, password hashing, token verification, permissions
  models.py          - Pydantic models for all entities
  utils.py           - serialize_doc, get_next_account_number
  services/
    financial.py     - Interest calc, payment processing, ledger generation
  routes/
    auth_routes.py   - Login, /me endpoints
    users.py         - User CRUD, permissions, status toggle
    dashboard.py     - Summary, stats
    accounts.py      - Account CRUD, close/reopen, landed/received, ledger, villages
    reports.py       - Village summary, monthly trend, rate distribution, top borrowers
    export.py        - Excel and PDF exports
  scripts/
    seed.py          - Data seeding script
```

## Key Business Logic
1. **Interest Formula**: Interest = (Principal x Rate x Days) / (100 x 30)
2. **Payment Distribution**: Interest paid first, remainder to principal (FIFO oldest first)
3. **Payment Date Rule**: Payment only affects landed entries that existed on or before the payment date
4. **Carry-Forward**: If payment < interest, remaining interest is carried forward proportionally
5. **Ledger**: All entries generated in chronological order for correct running balance

## Default Credentials
- **Admin**: admin / admin123
- **Operator**: operator1 / operator123
- **Viewer**: viewer1 / viewer123

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Authentication system
- [x] Core account management
- [x] Interest calculation engine
- [x] Ledger system
- [x] Payment date bug fix (future landed entries not affected)
- [x] Chronological ledger generation

### P1 (High Priority) - DONE
- [x] Reports and analytics dashboard (4 charts + tables)
- [x] Export to PDF/Excel (accounts list + individual account)
- [x] Backend refactoring (modular structure)
- [x] Data seeding script

### P2 (Medium Priority) - Future
- [ ] Interest history tracking
- [ ] Account renewal workflow
- [ ] Bulk import/export
- [ ] Mobile-responsive improvements
- [ ] Dark mode support
- [ ] Advanced search with saved filters

### P3 (Low Priority) - Future
- [ ] SMS/Email notifications
- [ ] Backup and restore
- [ ] Multi-language support
- [ ] Audit logs viewer
