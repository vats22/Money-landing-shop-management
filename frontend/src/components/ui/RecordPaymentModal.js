import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Spinner } from './Spinner';
import { PaymentAllocationEditor } from './PaymentAllocationEditor';
import { formatCurrency } from '../../lib/utils';
import api from '../../lib/api';

/**
 * RecordPaymentModal
 *
 * Quick "Record a Payment" flow from the Account Detail page. Calls
 * `GET /api/accounts/{id}/payments/preview` to fetch live per-entry interest +
 * outstanding for the selected date, then `POST /api/accounts/{id}/received`
 * to commit.
 *
 * Props:
 *   open : boolean
 *   onClose : fn
 *   accountId : string
 *   openingDate : YYYY-MM-DD (min selectable payment date)
 *   onPaymentRecorded : fn — called with the API response on success
 */
export function RecordPaymentModal({ open, onClose, accountId, openingDate, onPaymentRecorded }) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [allocationMethod, setAllocationMethod] = useState('fifo');
  const [allocations, setAllocations] = useState([]);
  const [preview, setPreview] = useState(null); // { entries: [], total_outstanding, total_interest_due }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when (re)opened
  useEffect(() => {
    if (open) {
      setPaymentDate(today);
      setAmount('');
      setNote('');
      setAllocationMethod('fifo');
      setAllocations([]);
      setPreview(null);
    }
  }, [open, today]);

  // Fetch payment preview whenever date changes
  useEffect(() => {
    if (!open || !accountId || !paymentDate) return;
    if (openingDate && paymentDate < openingDate) return;
    let cancelled = false;
    const fetchPreview = async () => {
      setLoading(true);
      try {
        const resp = await api.post(`/api/accounts/${accountId}/payments/preview?payment_date=${paymentDate}`);
        if (!cancelled) setPreview(resp.data);
      } catch (e) {
        if (!cancelled) {
          setPreview(null);
          toast.error(e.response?.data?.detail || 'Could not load payment preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPreview();
    return () => { cancelled = true; };
  }, [open, accountId, paymentDate, openingDate]);

  const numericAmount = parseFloat(amount) || 0;
  const totalOutstanding = preview?.total_outstanding || 0;
  const totalInterestDue = preview?.total_interest_due || 0;

  const handleSubmit = async () => {
    if (numericAmount <= 0) {
      toast.error('Enter a valid amount greater than 0');
      return;
    }
    if (openingDate && paymentDate < openingDate) {
      toast.error(`The selected date cannot be earlier than the Account Opening Date (${openingDate}).`);
      return;
    }
    const method = (preview?.entries?.length || 0) >= 2 ? allocationMethod : 'fifo';
    let payload = {
      date: paymentDate,
      amount: numericAmount,
      note: note || '',
      allocation_method: method,
    };
    if (method === 'manual') {
      const cleaned = (allocations || [])
        .filter(a => parseFloat(a.amount) > 0)
        .map(a => ({ landed_index: parseInt(a.landed_index, 10), amount: parseFloat(a.amount) }));
      const sum = cleaned.reduce((s, a) => s + a.amount, 0);
      if (Math.abs(sum - numericAmount) > 0.01) {
        toast.error(`Allocations must add up to ${formatCurrency(numericAmount)}. Currently allocated ${formatCurrency(sum)}.`);
        return;
      }
      payload.allocations = cleaned;
    }
    setSubmitting(true);
    try {
      const resp = await api.post(`/api/accounts/${accountId}/received`, payload);
      toast.success(`Receive amount of ${formatCurrency(numericAmount)} added`);
      onPaymentRecorded?.(resp.data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add receive amount');
    } finally {
      setSubmitting(false);
    }
  };

  // Build landed-entries shape expected by PaymentAllocationEditor (with live preview data)
  const landedForEditor = useMemo(() => {
    if (!preview?.entries) return [];
    return preview.entries.map(e => ({
      date: e.landed_date,
      amount: e.original_amount,
      interest_rate: e.interest_rate,
      remaining_principal: e.remaining_principal,
      interest_due: e.interest_due,
      outstanding: e.outstanding,
      _idx: e.landed_index,
    }));
  }, [preview]);

  const showAllocationEditor = (preview?.entries?.length || 0) >= 2;

  return (
    <Modal isOpen={open} onClose={onClose} title="Add Receive Amount" size="lg">
      <div className="space-y-4">
        {/* Date + Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
              Payment Date <span className="text-danger-ink">*</span>
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              min={openingDate || undefined}
              max={today}
              data-testid="rp-date"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
              Amount (₹) <span className="text-danger-ink">*</span>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="5000"
              data-testid="rp-amount"
            />
          </div>
        </div>

        {/* Outstanding summary */}
        {loading && (
          <div className="flex items-center justify-center py-6 text-secondary-ink text-sm gap-2">
            <Spinner size="sm" /> Calculating interest…
          </div>
        )}
        {!loading && preview && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3" data-testid="rp-preview-summary">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-white rounded px-2.5 py-1.5">
                <p className="text-muted-ink text-[10px] uppercase tracking-wider">Total Outstanding</p>
                <p className="text-primary-ink font-mono font-semibold tabular-nums" data-testid="rp-total-outstanding">{formatCurrency(totalOutstanding)}</p>
              </div>
              <div className="bg-white rounded px-2.5 py-1.5">
                <p className="text-muted-ink text-[10px] uppercase tracking-wider">Interest Due</p>
                <p className="text-warning-ink font-mono font-semibold tabular-nums">{formatCurrency(totalInterestDue)}</p>
              </div>
              <div className="bg-white rounded px-2.5 py-1.5 col-span-2 sm:col-span-1">
                <p className="text-muted-ink text-[10px] uppercase tracking-wider">Active Entries</p>
                <p className="text-primary-ink font-mono font-semibold tabular-nums">{preview.entries.filter(e => e.status === 'active').length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Allocation editor — only when there are ≥2 landed entries */}
        {showAllocationEditor && (
          <PaymentAllocationEditor
            landedEntries={landedForEditor}
            receivingAmount={numericAmount}
            allocationMethod={allocationMethod}
            allocations={allocations}
            onChange={({ allocation_method, allocations: next }) => {
              setAllocationMethod(allocation_method);
              setAllocations(next);
            }}
            testIdPrefix="rp"
            paymentDate={paymentDate}
          />
        )}

        {/* Note */}
        <div>
          <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
            Note (optional)
          </label>
          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Cash · UPI · partial gold returned…"
            data-testid="rp-note"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} data-testid="rp-cancel">
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || loading || numericAmount <= 0} data-testid="rp-submit">
            {submitting ? <Spinner size="sm" className="text-white" /> : 'Add Receive Amount'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
