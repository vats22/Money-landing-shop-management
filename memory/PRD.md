# LendLedger - Jewellery & Money Lending Management System

## Original Problem Statement
Build a full-stack Jewellery & Money Lending Management Web Application with:
- Multiple jewellery items per account
- Multiple lending entries per account
- Multiple received payment entries per account
- Date-wise interest calculation (monthly)
- Ledger-based financial tracking
- Role-based user permissions

## Technology Stack
- **Frontend**: React 18, Tailwind CSS, React Router, Recharts, react-day-picker
- **Backend**: Python FastAPI (modular structure with APIRouter)
- **Database**: MongoDB (Motor async driver)
- **Auth**: JWT Authentication with bcrypt password hashing

## Architecture
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
    dashboard.py     - Summary (active + closed), stats
    accounts.py      - Account CRUD, close/reopen, landed/received, ledger
    reports.py       - Village summary, monthly trend, rate distribution, top borrowers
    export.py        - Excel and PDF exports
  scripts/
    seed.py          - Data seeding script
```

## Default Credentials
- **Admin**: admin / admin123
- **Operator**: operator1 / operator123
- **Viewer**: viewer1 / viewer123

## Implemented Features

### Core
- [x] JWT Authentication (no public signup)
- [x] User Management with role-based permissions
- [x] Account CRUD with jewellery, landed, received entries
- [x] Interest calculation (monthly rate, carry-forward, FIFO principal)
- [x] Payment distribution (interest-first, then FIFO principal)
- [x] Financial Ledger with chronological audit trail
- [x] Close/Reopen account lifecycle

### Reports & Export
- [x] Reports Dashboard (4 charts + tables)
- [x] Export All Accounts to Excel
- [x] Export Individual Account to Excel (5 sheets)
- [x] Export Individual Account to PDF

### UI Components
- [x] DateRangePicker (dual-month calendar with presets: 7d, 30d, 90d, 1y)
- [x] SearchableDropdown (village filter with search inside dropdown)
- [x] Permission-based sidebar navigation
- [x] Permission-based button visibility (Add/Edit/Delete)

### Bug Fixes (Session 2)
- [x] Payment only affects landed entries that existed at/before payment date
- [x] Chronological ledger generation with correct running balance
- [x] Permissions update reflects immediately (matched_count fix + refreshUser)
- [x] Add/Edit/Delete buttons hidden for users without permissions
- [x] Sidebar items filtered by user permissions
- [x] Village dropdown with search functionality (not text input)
- [x] Closed accounts cannot be edited/deleted (must reopen first)
- [x] Dashboard separates active vs closed account totals

### Image Management (Session 3 - Bug Fixes)
- [x] Jewellery image upload in Edit Account form (up to 5 per item)
- [x] Live camera capture via getUserMedia API in edit form
- [x] Account Detail page jewellery tab - view-only image modal (no upload/delete)
- [x] Image viewer with navigation, thumbnails, delete in edit form
- [x] New account form shows "save first" note for images

### Account History (Session 2)
- [x] History tab on Account Detail page for close/reopen events
- [x] Close/reopen event logging with date, user, reason/remarks

## Prioritized Backlog

### P2 (Medium Priority) - Next
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
