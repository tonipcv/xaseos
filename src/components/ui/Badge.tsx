'use client';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  dot?: boolean;
  className?: string;
}

const variants = {
  default: 'bg-slateblue-50 text-slateblue-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-yellow-50 text-yellow-700',
  error: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-sand-200 text-warmgray-600',
};

export function Badge({ children, variant = 'default', dot, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
      variants[variant], className
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', 
        variant === 'default' || variant === 'success' ? 'bg-slateblue-500' :
        variant === 'warning' ? 'bg-yellow-500' :
        variant === 'error' ? 'bg-red-500' : 'bg-warmgray-400'
      )} />}
      {children}
    </span>
  );
}
