import React from 'react';
import { cn } from '../../lib/utils';

export const Badge = ({ variant = 'default', className, children }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const statusConfig = {
    continue: { variant: 'success', label: 'Continue' },
    closed: { variant: 'default', label: 'Closed' },
    renewed: { variant: 'info', label: 'Renewed' },
    'immediate action needed': { variant: 'danger', label: 'Action Needed' },
    active: { variant: 'success', label: 'Active' },
    inactive: { variant: 'default', label: 'Inactive' },
  };

  const config = statusConfig[status?.toLowerCase()] || { variant: 'default', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
};
