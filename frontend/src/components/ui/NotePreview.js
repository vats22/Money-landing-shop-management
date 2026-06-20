import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { StickyNote } from 'lucide-react';

const isEmpty = (html) => {
  if (!html) return true;
  const s = String(html).trim();
  return !s || s === '<p></p>' || s === '<p><br></p>' || s === '<br>';
};

/**
 * Notes preview that opens a portal-rendered popover, so it isn't clipped by
 * `overflow-hidden`/`overflow-x-auto` parents (tables, cards).
 */
export default function NotePreview({ html, label = 'Note', testId }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'bottom' });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Compute position relative to viewport
  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popW = 280;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    if (left + popW + margin > vw) left = Math.max(margin, vw - popW - margin);
    let top = rect.bottom + 6;
    let placement = 'bottom';
    // Flip up if not enough room below
    if (top + 200 > vh) {
      top = rect.top - 6;
      placement = 'top';
    }
    setCoords({ top, left, placement });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => setOpen(false); // close on any scroll
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (isEmpty(html)) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-testid={testId}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-amber-700 hover:bg-amber-100 transition-colors tap-target"
        title={label}
        aria-label={label}
      >
        <StickyNote className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.placement === 'top' ? undefined : coords.top,
            bottom: coords.placement === 'top' ? (window.innerHeight - coords.top) : undefined,
            left: coords.left,
            width: 280,
            zIndex: 120,
          }}
          className="rounded-lg border border-slate-200 bg-white shadow-xl p-3 text-xs text-primary-ink animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-ink font-semibold mb-1.5 flex items-center gap-1.5">
            <StickyNote className="h-3 w-3 text-amber-600" />
            {label}
          </div>
          <div
            className="safe-rich-text prose prose-xs max-w-none text-primary-ink [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
          />
        </div>,
        document.body
      )}
    </>
  );
}
