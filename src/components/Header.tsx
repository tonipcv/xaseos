'use client';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function Header({ title, children, className }: HeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <h1 className="text-xl font-semibold text-warmgray-700">{title}</h1>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
