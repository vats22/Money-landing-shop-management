import React, { useState, useRef, useEffect } from 'react';
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid="date-range-picker-btn"
        className="flex items-center gap-2 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-left bg-white hover:border-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      >
        <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <span className={`flex-1 tabular-nums ${range.from ? 'text-slate-800' : 'text-slate-400'}`}>
          {displayText}
        </span>
        {range.from && (
          <span onClick={handleClear} className="text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-3" data-testid="date-range-calendar">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={{ after: today }}
            defaultMonth={range.from || subDays(new Date(), 30)}
            showOutsideDays
            modifiersStyles={{
              selected: { backgroundColor: '#059669', color: 'white' },
              range_middle: { backgroundColor: '#d1fae5', color: '#064e3b' },
              today: { fontWeight: 'bold', border: '2px solid #059669' }
            }}
            styles={{
              months: { display: 'flex', gap: '1rem' },
              caption: { display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', padding: '0.5rem 0' },
              caption_label: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' },
              nav_button: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer' },
              head_cell: { fontSize: '0.75rem', fontWeight: '500', color: '#64748b', width: '36px', textAlign: 'center', padding: '0.25rem' },
              cell: { width: '36px', height: '36px', textAlign: 'center', padding: '1px' },
              day: { width: '34px', height: '34px', fontSize: '0.8rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
            }}
          />
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <div className="flex gap-2">
              {[
                { label: '7d', days: 7 },
                { label: '30d', days: 30 },
                { label: '90d', days: 90 },
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
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
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
              className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
