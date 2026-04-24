'use client';

import { useToast } from '@/lib/toast';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: 'bg-white border-slateblue-500 text-warmgray-700',
  error: 'bg-white border-red-400 text-warmgray-700',
  warning: 'bg-white border-yellow-400 text-warmgray-700',
  info: 'bg-white border-sand-400 text-warmgray-700',
};

const ICON_STYLES = {
  success: 'text-slateblue-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-warmgray-500',
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[280px] max-w-[420px]',
              'animate-in slide-in-from-bottom-2 duration-200',
              STYLES[t.variant]
            )}
          >
            <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', ICON_STYLES[t.variant])} />
            <p className="text-sm flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-warmgray-400 hover:text-warmgray-600 shrink-0 mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
