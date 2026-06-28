import React, { useMemo } from 'react';
import { Layers, Sparkles, AlertCircle } from 'lucide-react';
import { Input } from './Input';
import { formatCurrency } from '../../lib/utils';

/**
 * PaymentAllocationEditor
 *
 * Renders an Auto (FIFO) / Manual toggle plus a per-landed-entry allocation table.
 * Only used when the account has ≥ 2 landed entries.
 *
 * Props:
 *   landedEntries        : array of landed entry rows (need `date`, `amount`,
 *                          `interest_rate`, `remaining_principal` (optional),
 *                          and (optional) live `interest_due`/`outstanding`).
 *   receivingAmount      : the total receiving amount being allocated.
 *   allocationMethod     : "fifo" | "manual"
 *   allocations          : array of { landed_index, amount }
 *   onChange({ allocation_method, allocations })
 *   testIdPrefix         : prefix for data-testid (e.g. "received-0")
 *   paymentDate          : optional date string — used only to filter out
 *                          landed entries newer than the payment date.
 */
export function PaymentAllocationEditor({
  landedEntries = [],
  receivingAmount = 0,
  allocationMethod = 'fifo',
  allocations = [],
  onChange,
  testIdPrefix = 'alloc',
  paymentDate = null,
}) {
  const eligible = useMemo(() => {
    return (landedEntries || [])
      .map((le, idx) => ({ ...le, _idx: idx }))
      .filter((le) => !paymentDate || (le.date || '') <= paymentDate);
  }, [landedEntries, paymentDate]);

  const totalAllocated = useMemo(() => {
    return (allocations || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  }, [allocations]);

  const remaining = useMemo(() => {
    return Math.round((parseFloat(receivingAmount || 0) - totalAllocated) * 100) / 100;
  }, [receivingAmount, totalAllocated]);

  const setMethod = (method) => {
    if (method === 'fifo') {
      onChange({ allocation_method: 'fifo', allocations: [] });
    } else {
      // Seed allocations with rows for each eligible entry at 0
      const seed = eligible.map((le) => ({ landed_index: le._idx, amount: '' }));
      onChange({ allocation_method: 'manual', allocations: seed });
    }
  };

  const updateRow = (landed_index, amount) => {
    const next = allocations.map((a) =>
      a.landed_index === landed_index ? { ...a, amount } : a
    );
    onChange({ allocation_method: 'manual', allocations: next });
  };

  const fillThisAmount = (landed_index, max) => {
    const cap = Math.max(0, Math.min(remaining + (parseFloat(allocations.find(a => a.landed_index === landed_index)?.amount) || 0), max));
    updateRow(landed_index, cap.toFixed(2));
  };

  // Don't render the editor for accounts with fewer than 2 landed entries
  if ((landedEntries || []).length < 2) return null;

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-white" data-testid={`${testIdPrefix}-allocation-block`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-blue-100 bg-blue-50/50 rounded-t-lg">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
          <Layers className="h-3.5 w-3.5" />
          Allocation
        </div>
        <div className="inline-flex rounded-full bg-white p-0.5 ring-1 ring-blue-200">
          <button
            type="button"
            onClick={() => setMethod('fifo')}
            data-testid={`${testIdPrefix}-alloc-method-fifo`}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
              allocationMethod === 'fifo' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Sparkles className="inline h-3 w-3 mr-1 -mt-0.5" />Auto (FIFO)
          </button>
          <button
            type="button"
            onClick={() => setMethod('manual')}
            data-testid={`${testIdPrefix}-alloc-method-manual`}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
              allocationMethod === 'manual' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {allocationMethod === 'fifo' ? (
        <div className="px-3 py-2 text-[11px] text-secondary-ink">
          Will settle <strong className="text-blue-700">interest then principal</strong> of the oldest landed entry first,
          then move to the next.
        </div>
      ) : (
        <div className="p-3 space-y-3">
          <p className="text-[11px] text-secondary-ink">
            Enter how much of the <strong>{formatCurrency(receivingAmount)}</strong> goes to each landed entry. Within each entry,
            interest is cleared before principal automatically.
          </p>

          {/* Per-entry table */}
          <div className="overflow-x-auto -mx-3 px-3">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-secondary-ink uppercase tracking-wider">
                  <th className="text-left py-1.5 font-semibold">Landed Entry</th>
                  <th className="text-right py-1.5 font-semibold">Outstanding</th>
                  <th className="text-right py-1.5 font-semibold w-32">Allocate (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eligible.map((le) => {
                  const row = allocations.find((a) => a.landed_index === le._idx) || { amount: '' };
                  const interestDue = parseFloat(le.interest_due ?? le.total_interest ?? 0) || 0;
                  const principalLeft = parseFloat(le.remaining_principal ?? le.amount) || 0;
                  const outstanding = parseFloat(le.outstanding ?? (interestDue + principalLeft)) || 0;
                  return (
                    <tr key={le._idx} className="align-top">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium text-primary-ink">#{le._idx + 1} · {le.date}</div>
                        <div className="text-muted-ink text-[10px]">
                          P: {formatCurrency(principalLeft)} · I: {formatCurrency(interestDue)} · @{le.interest_rate}%
                        </div>
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-mono text-secondary-ink whitespace-nowrap">
                        {formatCurrency(outstanding)}
                      </td>
                      <td className="py-1.5 pl-1.5">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.amount}
                          onChange={(e) => updateRow(le._idx, e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="0"
                          className="h-8 text-right tabular-nums font-mono text-[12px]"
                          data-testid={`${testIdPrefix}-alloc-amount-${le._idx}`}
                        />
                        <button
                          type="button"
                          onClick={() => fillThisAmount(le._idx, outstanding)}
                          className="mt-1 w-full text-[10px] text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                          data-testid={`${testIdPrefix}-alloc-fill-${le._idx}`}
                          title="Fill remaining receiving up to this entry's outstanding"
                        >
                          Fill remaining
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-100">
            <div className="rounded bg-slate-50 px-2 py-1.5">
              <p className="text-muted-ink text-[10px] uppercase tracking-wider">Receiving</p>
              <p className="text-primary-ink font-mono font-semibold tabular-nums">{formatCurrency(receivingAmount)}</p>
            </div>
            <div className="rounded bg-blue-50 px-2 py-1.5">
              <p className="text-blue-700 text-[10px] uppercase tracking-wider">Allocated</p>
              <p className="text-blue-900 font-mono font-semibold tabular-nums" data-testid={`${testIdPrefix}-allocated-total`}>{formatCurrency(totalAllocated)}</p>
            </div>
            <div className={`rounded px-2 py-1.5 ${Math.abs(remaining) < 0.01 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className={`text-[10px] uppercase tracking-wider ${Math.abs(remaining) < 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>Remaining</p>
              <p className={`font-mono font-semibold tabular-nums ${Math.abs(remaining) < 0.01 ? 'text-emerald-900' : 'text-amber-900'}`} data-testid={`${testIdPrefix}-remaining-amount`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          {Math.abs(remaining) > 0.01 && (
            <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                {remaining > 0
                  ? `Allocate the remaining ${formatCurrency(remaining)} — total must equal the receiving amount.`
                  : `Over-allocated by ${formatCurrency(-remaining)} — please adjust.`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
