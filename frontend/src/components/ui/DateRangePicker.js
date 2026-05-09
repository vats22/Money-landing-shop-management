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
  // Active "side" the user is currently picking — drives which month is displayed.
  const [activeSide, setActiveSide] = useState('from'); // 'from' | 'to'
  const [displayMonth, setDisplayMonth] = useState(
    startDate ? new Date(startDate + 'T00:00:00') : subDays(new Date(), 30)
  );
  const containerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Only attach a global click listener on desktop where the popover sits
    // inline in the document. On mobile, the modal has its own backdrop that
    // closes the picker, and adding a global listener can race with DayPicker's
    // own click handling and close the picker prematurely.
    const isDesktop = window.innerWidth >= 640;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);

    let handleClickOutside;
    if (isDesktop) {
      handleClickOutside = (e) => {
        const t = e.target;
        if (t && t.closest && t.closest('[data-testid="date-range-calendar"]')) return;
        if (containerRef.current && containerRef.current.contains(t)) return;
        setOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (handleClickOutside) document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    setRange({
      from: startDate ? new Date(startDate + 'T00:00:00') : subDays(new Date(), 30),
      to: endDate ? new Date(endDate + 'T00:00:00') : new Date()
    });
  }, [startDate, endDate]);

  // Each time the picker is (re)opened, focus the From side and jump the
  // visible month to the current From date so the user starts fresh.
  useEffect(() => {
    if (open) {
      setActiveSide('from');
      const target = startDate
        ? new Date(startDate + 'T00:00:00')
        : (range.from || subDays(new Date(), 30));
      setDisplayMonth(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelect = (selectedRange) => {
    // eslint-disable-next-line no-console
    console.log('[DRP] handleSelect:', JSON.stringify(selectedRange));
    if (!selectedRange) return;
    setRange(selectedRange);
    if (selectedRange.from && selectedRange.to) {
      onChange({
        startDate: format(selectedRange.from, 'yyyy-MM-dd'),
        endDate: format(selectedRange.to, 'yyyy-MM-dd')
      });
      // eslint-disable-next-line no-console
      console.log('[DRP] both set, CLOSING');
      setOpen(false);
    } else if (selectedRange.from && !selectedRange.to) {
      // User just picked the start date — switch focus to TO so the next tap
      // is interpreted as the end date, and surface visual cue.
      setActiveSide('to');
      // eslint-disable-next-line no-console
      console.log('[DRP] partial selection, awaiting end date');
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

  // Visible chips showing the current selection — TAPPABLE so users can jump
  // the visible month to the start or end month quickly.
  const FromToChips = (
    <div className="flex items-center gap-2 mb-3">
      <button
        type="button"
        onClick={() => {
          setActiveSide('from');
          if (range.from) setDisplayMonth(range.from);
        }}
        data-testid="drp-from-chip"
        className={`flex-1 px-2.5 py-1.5 rounded-md border text-left transition-all tap-target ${
          activeSide === 'from'
            ? 'bg-emerald-600 border-emerald-700 ring-2 ring-emerald-300'
            : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
        }`}
      >
        <p className={`text-[9px] uppercase tracking-wider font-semibold ${
          activeSide === 'from' ? 'text-emerald-50' : 'text-emerald-700'
        }`}>From</p>
        <p className={`text-xs font-mono tabular-nums ${
          activeSide === 'from' ? 'text-white' : 'text-emerald-900'
        }`}>
          {range.from ? format(range.from, 'dd MMM yyyy') : '—'}
        </p>
      </button>
      <span className="text-secondary-ink">→</span>
      <button
        type="button"
        onClick={() => {
          setActiveSide('to');
          if (range.to) setDisplayMonth(range.to);
          else if (range.from) setDisplayMonth(range.from);
        }}
        data-testid="drp-to-chip"
        className={`flex-1 px-2.5 py-1.5 rounded-md border text-left transition-all tap-target ${
          activeSide === 'to'
            ? 'bg-emerald-600 border-emerald-700 ring-2 ring-emerald-300'
            : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
        }`}
      >
        <p className={`text-[9px] uppercase tracking-wider font-semibold ${
          activeSide === 'to' ? 'text-emerald-50' : 'text-emerald-700'
        }`}>To</p>
        <p className={`text-xs font-mono tabular-nums ${
          activeSide === 'to' ? 'text-white' : 'text-emerald-900'
        }`}>
          {range.to ? format(range.to, 'dd MMM yyyy') : '—'}
        </p>
      </button>
    </div>
  );

  // The calendar panel — same structure for desktop popover and mobile portal modal.
  const CalendarPanel = (
    <div
      ref={panelRef}
      className="bg-white rounded-xl shadow-2xl border border-slate-200 p-3 max-w-[calc(100vw-1.5rem)] overflow-hidden"
      data-testid="date-range-calendar"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
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
        {activeSide === 'from'
          ? 'Pick the start date below'
          : 'Now pick the end date — use < > or year dropdown to navigate'}
      </p>
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleSelect}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        numberOfMonths={isMobile ? 1 : 2}
        disabled={{ after: today }}
        captionLayout="dropdown-buttons"
        fromYear={2015}
        toYear={today.getFullYear()}
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
