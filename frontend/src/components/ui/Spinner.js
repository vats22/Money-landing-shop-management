import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export const Spinner = ({ className, size = 'default' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={cn('animate-spin text-emerald-600', sizes[size], className)} />
  );
};

export const LoadingOverlay = ({ message = 'Loading...' }) => (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 shadow-xl flex flex-col items-center gap-4">
      <Spinner size="lg" />
      <p className="text-slate-600 font-medium">{message}</p>
    </div>
  </div>
);
