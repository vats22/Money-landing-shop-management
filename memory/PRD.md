# LendLedger - Jewellery & Money Lending Management

## Vision
Modern web app to digitize jewellery-pledge lending operations: track accounts, jewellery items pledged, money lent (landed) and received with automatic interest calculation, ledger generation, and audit history.

## Tech stack
- React 19 + Tailwind + Lucide + react-quill-new + DOMPurify
- FastAPI + Motor (Mongo) + JWT auth
- Object storage (Emergent) for jewellery images

## Core requirements
- Multi-user with roles: master_admin, admin, ledger_owner, basic_user, view_only
- Accounts CRUD with nested jewellery items, landed entries, received entries
- Auto interest calc (monthly rate × days / 30), payment allocation (interest first, then principal)
- Chronological ledger + Enhanced ledger (per-period interest breakdown + computed notes)
- Close / Reopen workflow with full audit history
- Account # auto-numbering (ACC000001…)
- Reports + Excel/CSV exports
- Image upload for jewellery (multi-image gallery with zoom)

## Status (rolling)

### Completed (with dates)
- 2026-04-22 — Auth (JWT) + RBAC, accounts CRUD, ledger generation, reports, exports
- 2026-05-01 — Image gallery with multi-upload, zoom, lightbox
- 2026-05-07 — Initial deployment / preview live
- 2026-05-09 — **Bug fixes**: ACC4 detail page TypeError (datetime tz mix), ACC5 pending principal `or` falsy bug, status→closed via dropdown didn't add to close_history, interest_start_date column added to ledger breakdown, image fetch retry/cache. **Uncovered fix**: `update_account` no longer corrupts paid-off remaining_principal when only non-entry fields are updated.
- 2026-05-09 — **Notes feature**: rich-text (Quill) note per landed/received entry (HTML, max ~500 chars), persisted in DB, displayed in ledger as 📝 icon with popover, full note shown in expanded ledger row.
- 2026-05-09 — **Mobile / responsive overhaul**: card view <lg, persistent bottom navigation (Home/Accounts/Reports/More), filter bottom sheet, single-column edit form, 44px tap targets, tabular-nums everywhere, sticky table headers + first column, semantic color tokens (text.primary/secondary/muted, state.success/danger/warning/info), density toggle (Comfortable/Compact) on Accounts table, friendly empty states.
- 2026-05-09 — **Mobile DateRangePicker fix**: FROM/TO chips are now interactive buttons that jump the calendar to that date's month + month/year dropdown caption (`captionLayout="dropdown-buttons"`) for instant navigation. After picking the start date, focus auto-switches to TO with a clear hint. Tested on both mobile (390×844) and desktop viewports.

### P0 backlog (next)
- Account Consolidation / Merge wizard (N→1, settle + transfer-in tagged as `is_internal_transfer`)
- Account Renewal wizard (cycle-based: close cycle 1, open cycle 2 on same account)
- Cycles tab on Account Detail with per-cycle history
- Borrower view (group accounts by name+mobile)

### P1 backlog
- Mobile ledger as vertical timeline
- Notes preset chips (Cash / UPI / Cheque / Renewed)
- Inline form validation (real-time, not only on submit)
- Empty-state illustrations on Reports / Users pages
- "Unmerge" reverse flow
- Audit trail / change log per account
- Bulk actions (close multiple accounts)

### P2 backlog
- Native mobile app via PWA install prompt
- Offline mode (read-only)
- Multi-currency support

## Test credentials
admin / admin123 (master_admin) — see /app/memory/test_credentials.md

## Architecture decisions captured
- Internal transfers (merge-related) must be tagged `is_internal_transfer: true` and excluded from cash-flow dashboards to keep totals correct.
- Interest first, then principal payment allocation; interest_start_date resets on full-interest payment.
- Renewal preserves cycle history (account stays, cycles[] grows).

