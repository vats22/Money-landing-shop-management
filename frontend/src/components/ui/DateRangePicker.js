import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { format, subDays, startOfDay } from 'date-fns';
import { Calendar, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';

export function DateRangePicker({ startDate, endDate, onChange, maxDate }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({
    from: startDate ? new Date(startDate + 'T00:00:00') : subDays(new Date(), 30),
    to: endDate ? new Date(endDate + 'T00:00:00') : new Date()
  });
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setRange({
      from: startDate ? new Date(startDate + 'T00:00:00') : subDays(new Date(), 30),
      to: endDate ? new Date(endDate + 'T00:00:00') : new Date()
    });
  }, [startDate, endDate]);

  const handleSelect = (selectedRange) => {
    if (!selectedRange) return;
    setRange(selectedRange);
    if (selectedRange.from && selectedRange.to) {
      onChange({
        startDate: format(selectedRange.from, 'yyyy-MM-dd'),
        endDate: format(selectedRange.to, 'yyyy-MM-dd')
      });
      setOpen(false);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setRange({ from: undefined, to: undefined });
    onChange({ startDate: '', endDate: '' });
  };

  const displayText = range.from && range.to
    ? `${format(range.from, 'dd.MM.yyyy')} - ${format(range.to, 'dd.MM.yyyy')}`
    : 'Select date range';

  const today = maxDate ? new Date(maxDate + 'T00:00:00') : new Date();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Visible chips showing the current selection so the user knows what's selected
  const FromToChips = (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex-1 px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
        <p className="text-[9px] uppercase tracking-wider text-emerald-700 font-semibold">From</p>
        <p className="text-xs font-mono tabular-nums text-emerald-900">
          {range.from ? format(range.from, 'dd MMM yyyy') : '—'}
        </p>
      </div>
      <span className="text-secondary-ink">→</span>
      <div className="flex-1 px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
        <p className="text-[9px] uppercase tracking-wider text-emerald-700 font-semibold">To</p>
        <p className="text-xs font-mono tabular-nums text-emerald-900">
          {range.to ? format(range.to, 'dd MMM yyyy') : '—'}
        </p>
      </div>
    </div>
  );

  // The calendar panel — same structure for desktop popover and mobile portal modal.
  const CalendarPanel = (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-3 max-w-[calc(100vw-1.5rem)] overflow-hidden" data-testid="date-range-calendar">
      {isMobile && (
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <h4 className="text-sm font-semibold text-primary-ink">Select date range</h4>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md hover:bg-slate-100 tap-target"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-secondary-ink" />
          </button>
        </div>
      )}
      {FromToChips}
      <p className="text-[10px] text-muted-ink mb-2 text-center">
        Tap <strong>start</strong> date, then tap <strong>end</strong> date
      </p>
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleSelect}
        numberOfMonths={isMobile ? 1 : 2}
        disabled={{ after: today }}
        defaultMonth={range.from || subDays(new Date(), 30)}
        showOutsideDays
        modifiersStyles={{
          selected: { backgroundColor: '#059669', color: 'white' },
          range_middle: { backgroundColor: '#d1fae5', color: '#064e3b' },
          today: { fontWeight: 'bold', border: '2px solid #059669' }
        }}
        styles={{
          months: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
          caption: { display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', padding: '0.5rem 0' },
          caption_label: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' },
          nav_button: { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer' },
          head_cell: { fontSize: '0.75rem', fontWeight: '500', color: '#64748b', width: '36px', textAlign: 'center', padding: '0.25rem' },
          cell: { width: '36px', height: '36px', textAlign: 'center', padding: '1px' },
          day: { width: '34px', height: '34px', fontSize: '0.8rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: '7d', days: 7 },
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
            { label: '180d', days: 180 },
            { label: '1y', days: 365 },
          ].map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const newRange = { from: subDays(new Date(), preset.days), to: new Date() };
                setRange(newRange);
                onChange({
                  startDate: format(newRange.from, 'yyyy-MM-dd'),
                  endDate: format(newRange.to, 'yyyy-MM-dd')
                });
                setOpen(false);
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-emerald-100 hover:text-emerald-700 transition-colors tap-target"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setRange({ from: undefined, to: undefined });
            onChange({ startDate: '', endDate: '' });
            setOpen(false);
          }}
          className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors tap-target"
        >
          Clear
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid="date-range-picker-btn"
        className="flex items-center gap-2 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-left bg-white hover:border-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 tap-target"
      >
        <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <span className={`flex-1 tabular-nums truncate ${range.from ? 'text-slate-800' : 'text-slate-400'}`}>
          {displayText}
        </span>
        {range.from && (
          <span onClick={handleClear} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && isMobile && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative animate-slideUp" onClick={(e) => e.stopPropagation()}>
            {CalendarPanel}
          </div>
        </div>,
        document.body
      )}

      {open && !isMobile && (
        <div className="absolute z-50 mt-1 right-0">
          {CalendarPanel}
        </div>
      )}
    </div>
  );
}
