import React, { useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ color: [] }, { background: [] }],
  ['clean']
];

/**
 * Compact rich-text editor used for per-entry notes.
 * Stores HTML strings.
 */
export default function NoteEditor({ value, onChange, placeholder = 'Add a note (optional)…', testId }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && testId) {
      const root = ref.current.getEditor()?.root;
      if (root) root.setAttribute('data-testid', testId);
    }
  }, [testId]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <ReactQuill
        ref={ref}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={{ toolbar: TOOLBAR }}
        placeholder={placeholder}
        className="text-sm"
      />
    </div>
  );
}
