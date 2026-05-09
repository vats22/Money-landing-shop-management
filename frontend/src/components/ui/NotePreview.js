import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { StickyNote } from 'lucide-react';

/**
 * Inline notes preview: shows a 📝 icon if there's a note, click → popover with sanitized HTML preview.
 */
export default function NotePreview({ html, label = 'Note', testId }) {
  const [open, setOpen] = useState(false);
  if (!html || !String(html).trim() || html === '<p></p>' || html === '<p><br></p>') return null;

  return (
    <span className="relative inline-flex items-center" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-amber-700 hover:bg-amber-100 transition-colors"
        title={label}
        aria-label={label}
      >
        <StickyNote className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute z-30 top-full left-0 mt-1 w-64 max-w-[80vw] rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-xs text-slate-700"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-ink font-semibold mb-1">{label}</div>
          <div
            className="note-preview-html prose prose-xs max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
          />
        </div>
      )}
    </span>
  );
}
