import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export function MultiSelectDropdown({ options, value = [], onChange, placeholder = 'Select...', searchPlaceholder = 'Search...', testId }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggleOption = (opt) => {
    const newValue = value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt];
    onChange(newValue);
  };

  const removeTag = (e, opt) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== opt));
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
    setSearch('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid={testId || 'multi-select-dropdown'}
        className="flex items-center gap-1 w-full min-h-[42px] px-2 py-1.5 border border-slate-300 rounded-xl text-sm text-left bg-white hover:border-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {value.length === 0 ? (
            <span className="text-slate-400 px-1">{placeholder}</span>
          ) : (
            value.map(v => (
              <span key={v} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-md border border-emerald-200 max-w-[120px]">
                <span className="truncate">{v}</span>
                <X className="h-3 w-3 flex-shrink-0 cursor-pointer hover:text-red-500" onClick={(e) => removeTag(e, v)} />
              </span>
            ))
          )}
        </div>
        {value.length > 0 ? (
          <span onClick={clearAll} className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-0.5">
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden" data-testid={`${testId || 'multi-select'}-menu`}>
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          {value.length > 0 && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500">{value.length} selected</span>
              <button type="button" onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className={`w-full px-3 py-2.5 text-sm text-left transition-colors flex items-center gap-2 ${
                    value.includes(opt) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    value.includes(opt) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
                  }`}>
                    {value.includes(opt) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate">{opt}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-slate-400">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
