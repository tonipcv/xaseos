'use client';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-warmgray-700">{label}</label>}
      <input
        className={cn(
          'w-full bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm',
          'focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none',
          'placeholder:text-warmgray-400',
          error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, className, ...props }: TextAreaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-warmgray-700">{label}</label>}
      <textarea
        className={cn(
          'w-full bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm min-h-[120px] resize-y',
          'focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none',
          'placeholder:text-warmgray-400',
          error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
