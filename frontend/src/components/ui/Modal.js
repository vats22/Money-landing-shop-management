import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

// Portal helper — ensures fixed-positioned modals escape transformed ancestors
const ModalPortal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

// Lock body scroll while a modal is open
const useBodyScrollLock = (locked) => {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [locked]);
};

export const Modal = ({ isOpen, onClose, title, children, size = 'default' }) => {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    default: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          onClick={onClose}
        />
        <div className={cn(
          'relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-auto animate-slideUp',
          sizes[size]
        )}>
          <div className="sticky top-0 bg-white border-b border-slate-200 px-5 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
            <h2 className="text-lg sm:text-xl font-semibold font-display text-primary-ink">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors tap-target"
            >
              <X className="h-5 w-5 text-secondary-ink" />
            </button>
          </div>
          <div className="p-5 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  const variants = {
    danger: { icon: AlertCircle, iconClass: 'text-red-600 bg-red-100', buttonClass: 'bg-red-600 hover:bg-red-700' },
    warning: { icon: AlertTriangle, iconClass: 'text-amber-600 bg-amber-100', buttonClass: 'bg-amber-600 hover:bg-amber-700' },
    info: { icon: Info, iconClass: 'text-blue-600 bg-blue-100', buttonClass: 'bg-blue-600 hover:bg-blue-700' },
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 animate-slideUp"
          role="alertdialog"
          aria-labelledby="confirm-title"
        >
          <div className="flex items-start gap-4">
            <div className={cn('p-3 rounded-full flex-shrink-0', config.iconClass)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="confirm-title" className="text-lg font-semibold text-primary-ink">{title}</h3>
              <p className="mt-2 text-sm text-secondary-ink leading-relaxed">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-primary-ink hover:bg-slate-100 rounded-lg transition-colors tap-target"
            >
              {cancelText}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={cn(
                'px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors tap-target',
                config.buttonClass
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
