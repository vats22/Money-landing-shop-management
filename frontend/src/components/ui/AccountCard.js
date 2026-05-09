import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../lib/utils';
import { StatusBadge } from './Badge';
import { Eye, Pencil, Trash2, MoreHorizontal, MapPin, Calendar } from 'lucide-react';

const statusBorderClass = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'continue': return 'acct-card-border-success';
    case 'closed': return 'acct-card-border-muted';
    case 'renewed': return 'acct-card-border-info';
    case 'immediate action needed': return 'acct-card-border-danger';
    default: return 'acct-card-border-muted';
  }
};

export default function AccountCard({ account, canEdit, canDelete, onDelete, onEdit, onView }) {
  const totalPending = (account.total_pending_amount || 0) + (account.total_pending_interest || 0);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 ${statusBorderClass(account.status)} shadow-sm hover:shadow-md transition-shadow`}
      data-testid={`account-card-${account.id}`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <Link
              to={`/accounts/${account.id}`}
              className="font-mono text-xs font-semibold text-emerald-700 hover:underline"
            >
              {account.account_number}
            </Link>
            <Link
              to={`/accounts/${account.id}`}
              className="block text-base font-semibold text-primary-ink leading-snug truncate hover:text-emerald-700"
            >
              {account.name}
            </Link>
          </div>
          <StatusBadge status={account.status} />
        </div>

        {/* Sub-header */}
        <div className="flex items-center gap-3 text-xs text-secondary-ink mb-3">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {account.village || '-'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {formatDate(account.opening_date)}
          </span>
        </div>

        {/* Hero number + secondary chips */}
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-ink font-semibold">Total Pending</span>
            <span className="text-base font-bold tabular-nums text-primary-ink">
              {formatCurrency(totalPending)}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-ink">Principal</span>
              <span className="tabular-nums text-warning-ink font-semibold">
                {formatCurrency(account.total_pending_amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-ink">Interest</span>
              <span className="tabular-nums text-danger-ink font-semibold">
                {formatCurrency(account.total_pending_interest)}
              </span>
            </div>
          </div>
        </div>

        {/* Tertiary stats */}
        <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
          <div className="flex items-center justify-between bg-emerald-50/60 rounded px-2 py-1.5">
            <span className="text-emerald-700 font-medium">Lent</span>
            <span className="tabular-nums text-emerald-800 font-semibold">{formatCurrency(account.total_landed_amount)}</span>
          </div>
          <div className="flex items-center justify-between bg-blue-50/60 rounded px-2 py-1.5">
            <span className="text-blue-700 font-medium">Recd</span>
            <span className="tabular-nums text-blue-800 font-semibold">{formatCurrency(account.total_received_amount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
          <span className="text-[11px] text-muted-ink">
            {account.jewellery_items?.length || 0} jewellery · updated {formatDate(account.updated_at)}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onView?.(account)}
              data-testid={`card-view-${account.id}`}
              className="p-2 rounded-lg hover:bg-blue-50 tap-target"
              title="View"
              aria-label="View account"
            >
              <Eye className="h-4 w-4 text-blue-600" />
            </button>
            {canEdit && account.status !== 'closed' && (
              <button
                onClick={() => onEdit?.(account)}
                data-testid={`card-edit-${account.id}`}
                className="p-2 rounded-lg hover:bg-amber-50 tap-target"
                title="Edit"
                aria-label="Edit account"
              >
                <Pencil className="h-4 w-4 text-amber-600" />
              </button>
            )}
            {canDelete && account.status !== 'closed' && (
              <button
                onClick={() => onDelete?.(account)}
                data-testid={`card-delete-${account.id}`}
                className="p-2 rounded-lg hover:bg-red-50 tap-target"
                title="Delete"
                aria-label="Delete account"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
