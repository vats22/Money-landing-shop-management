import React from 'react';
import { cn } from '../../lib/utils';

export const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default',
  children,
  ...props 
}, ref) => {
  const variants = {
    default: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    outline: 'border border-slate-300 bg-transparent hover:bg-slate-100 text-slate-900',
    ghost: 'hover:bg-slate-100 hover:text-slate-900',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
    secondary: 'bg-amber-600 text-white hover:bg-amber-700',
  };

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-8 px-3 text-sm',
    lg: 'h-12 px-6 text-lg',
    icon: 'h-10 w-10',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-sm font-medium',
        'transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';
