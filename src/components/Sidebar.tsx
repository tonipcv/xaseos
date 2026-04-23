'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Settings, PlayCircle, BarChart3, Database, TrendingUp, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: PlayCircle },
  { href: '/runs', label: 'Runs', icon: BarChart3 },
  { href: '/datasets', label: 'Datasets', icon: Database },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface User { id: string; name?: string; email: string; role: string; }

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.get<User>('/api/auth/me').then(setUser).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await api.post('/api/auth/logout', {});
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-sand-50 flex flex-col z-40">
      <div className="px-3 py-3">
        <Link href="/dashboard" className="block w-8 h-auto">
          <Image
            src="/logo.png"
            alt="XASE OS"
            width={32}
            height={32}
            className="w-full h-auto object-contain rounded-lg"
            style={{ filter: 'invert(1) contrast(1.2)' }}
            priority
          />
        </Link>
      </div>

      <nav className="flex-1 px-2.5 py-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150',
                active
                  ? 'bg-sand-200 text-warmgray-700 font-medium'
                  : 'text-warmgray-500 hover:text-warmgray-700 hover:bg-sand-100'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2.5 py-2.5 space-y-1">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md">
          <div className="w-7 h-7 rounded-full bg-warmgray-700 text-white flex items-center justify-center text-xs font-medium shrink-0">
            {(user?.name ?? user?.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-warmgray-700 truncate">{user?.name ?? user?.email ?? 'User'}</div>
            <div className="text-[10px] text-warmgray-500 capitalize">{user?.role ?? 'reviewer'}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-warmgray-500 hover:text-warmgray-700 hover:bg-sand-100 transition-all">
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
