'use client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const variants = {
  primary: 'bg-slateblue-700 hover:bg-slateblue-800 text-white border-transparent',
  secondary: 'bg-sand-200 hover:bg-sand-300 text-warmgray-700 border-sand-300',
  ghost: 'bg-transparent hover:bg-sand-100 text-warmgray-600 hover:text-warmgray-700 border-transparent',
  danger: 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200',
  outline: 'bg-transparent hover:bg-sand-50 text-warmgray-700 border-sand-300',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  children, className, variant = 'primary', size = 'md', loading, disabled, ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all duration-150 disabled:opacity-50',
        variants[variant], sizes[size], className
      )}
      disabled={disabled || loading} {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}
