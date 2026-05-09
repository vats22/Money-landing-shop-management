import React, { useState } from 'react';
import { ChevronDown, StickyNote } from 'lucide-react';
import DOMPurify from 'dompurify';
import { formatCurrency, formatDate } from '../../lib/utils';

const TYPE_STYLES = {
  LANDED:   { bg: 'bg-emerald-50',  border: 'border-l-emerald-500', pill: 'bg-emerald-100 text-emerald-800' },
  PAYMENT:  { bg: 'bg-blue-50',     border: 'border-l-blue-500',    pill: 'bg-blue-100 text-blue-800' },
  CLOSED:   { bg: 'bg-red-50',      border: 'border-l-red-500',     pill: 'bg-red-100 text-red-800' },
  REOPENED: { bg: 'bg-green-50',    border: 'border-l-green-500',   pill: 'bg-green-100 text-green-800' },
};

/**
 * Mobile-optimized ledger entry card. Tap → expand to show breakdown / details.
 */
export default function LedgerCard({ entry, index }) {
  const [open, setOpen] = useState(false);
  const t = entry.transaction_type;
  const style = TYPE_STYLES[t] || { bg: 'bg-slate-50', border: 'border-l-slate-400', pill: 'bg-slate-100 text-slate-700' };
  const isLanded = t === 'LANDED';
  const isPayment = t === 'PAYMENT';
  const isClosed = t === 'CLOSED';
  const isReopened = t === 'REOPENED';
  const principalPaid = parseFloat(entry.principal_amount || 0);
  const interestPaid = parseFloat(entry.interest_amount || 0);
  const remInt = parseFloat(entry.remaining_interest || 0);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 ${style.border} border-l-4 shadow-sm overflow-hidden`}
      data-testid={`ledger-card-${index}`}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left ${style.bg} px-4 py-3 flex items-center justify-between gap-3 tap-target`}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${style.pill}`}>
              {t}
            </span>
            <span className="text-xs text-secondary-ink">{formatDate(entry.transaction_date)}</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-base font-bold tabular-nums text-primary-ink">
              {(isClosed || isReopened) ? '—' : formatCurrency(entry.amount)}
            </span>
            {entry.user_note && <StickyNote className="h-3.5 w-3.5 text-amber-600" />}
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-secondary-ink transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-slate-100 space-y-3 animate-fadeIn">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {isPayment && (
              <>
                <Stat label="Interest Paid" value={interestPaid > 0 ? formatCurrency(interestPaid) : '—'} valueClass="text-success-ink" />
                <Stat label="Principal Paid" value={principalPaid > 0 ? formatCurrency(principalPaid) : '—'} valueClass="text-info-ink" />
                <Stat label="Interest Charged" value={entry.interest_charged > 0 ? formatCurrency(entry.interest_charged) : '—'} valueClass="text-warning-ink" />
                <Stat label="Rem. Interest" value={remInt > 0 ? formatCurrency(remInt) : '—'} valueClass="text-danger-ink" />
              </>
            )}
            {isLanded && Array.isArray(entry.breakdown) && entry.breakdown[0] && (
              <>
                <Stat label="Principal" value={formatCurrency(entry.breakdown[0].principal)} valueClass="text-success-ink" />
                <Stat label="Rate (monthly)" value={`${entry.breakdown[0].rate}%`} valueClass="text-success-ink" />
              </>
            )}
            <Stat label="Rem. Principal" value={formatCurrency(entry.remaining_principal)} valueClass="text-warning-ink" />
            <Stat label="Balance" value={formatCurrency(entry.computed_balance)} valueClass="text-purple-700 font-bold" />
          </div>

          {/* Interest breakdown — collapsed list per period */}
          {isPayment && Array.isArray(entry.breakdown) && entry.breakdown.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-3 py-2 bg-slate-100/70 text-[10px] uppercase tracking-wider font-semibold text-secondary-ink">
                Interest Breakdown
              </div>
              <div className="divide-y divide-slate-200/70">
                {entry.breakdown.map((b, bi) => (
                  <div key={bi} className="px-3 py-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-secondary-ink">From {formatDate(b.interest_start_date || b.landed_date)}</span>
                      <span className="text-muted-ink">{b.days} days @ {b.rate}%</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <BD label="Principal" v={formatCurrency(b.principal)} />
                      <BD label="New Int." v={formatCurrency(b.calculated_interest || 0)} c="text-warning-ink" />
                      {(b.carried_forward || 0) > 0 && <BD label="Carry" v={formatCurrency(b.carried_forward)} c="text-orange-600" />}
                      <BD label="Total" v={formatCurrency(b.interest_due)} c="font-bold text-amber-900" />
                      {b.interest_paid > 0 && <BD label="Paid" v={formatCurrency(b.interest_paid)} c="text-success-ink" />}
                      {b.principal_paid > 0 && <BD label="Pri. Pd" v={formatCurrency(b.principal_paid)} c="text-info-ink" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User note */}
          {entry.user_note && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <StickyNote className="h-3.5 w-3.5 text-amber-700" />
                <span className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">User Note</span>
              </div>
              <div
                className="prose prose-xs max-w-none text-amber-900 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.user_note) }}
              />
            </div>
          )}

          {/* Computed note */}
          {entry.notes && (
            <p className="text-[11px] text-secondary-ink leading-relaxed">
              <span className="text-[10px] uppercase tracking-wider text-muted-ink font-semibold mr-1.5">Computed</span>
              {entry.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueClass = 'text-primary-ink' }) {
  return (
    <div className="rounded-md bg-slate-50 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-ink font-medium">{label}</p>
      <p className={`text-xs font-mono tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}

function BD({ label, v, c = 'text-primary-ink' }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] uppercase text-muted-ink">{label}</span>
      <span className={`text-xs font-mono tabular-nums ${c}`}>{v}</span>
    </span>
  );
}
