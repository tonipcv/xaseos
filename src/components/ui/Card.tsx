'use client';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div className={cn(
      'bg-white border border-sand-300 rounded-xl p-5',
      onClick && 'cursor-pointer hover:border-sand-400 transition-colors',
      className
    )} onClick={onClick}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, sub, icon, className }: StatCardProps) {
  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-warmgray-500 font-medium uppercase tracking-wide">{label}</span>
        {icon && <div className="text-warmgray-500">{icon}</div>}
      </div>
      <span className="text-2xl font-bold text-warmgray-700">{value}</span>
      {sub && <span className="text-xs text-warmgray-500">{sub}</span>}
    </Card>
  );
}
