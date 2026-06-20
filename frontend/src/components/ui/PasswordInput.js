import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * PasswordInput
 * A drop-in replacement for <Input type="password" /> that adds a
 * show/hide toggle (eye icon) on the right edge of the field.
 *
 * Props mirror a regular <input>. Provide `data-testid` and the toggle
 * button will automatically expose `<testid>-toggle`.
 */
export const PasswordInput = React.forwardRef(
  ({ className, 'data-testid': testId, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const toggleTestId = testId ? `${testId}-toggle` : undefined;

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          data-testid={testId}
          className={cn(
            'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm',
            'ring-offset-background placeholder:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-200',
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          data-testid={toggleTestId}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
