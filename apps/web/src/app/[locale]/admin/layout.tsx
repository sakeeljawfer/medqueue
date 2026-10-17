'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { cn, Button } from '@medqueue/ui';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const NAV = [
  { href: '/admin', key: 'overview', icon: '📊' },
  { href: '/admin/doctors', key: 'doctors', icon: '👨‍⚕️' },
  { href: '/admin/payments', key: 'payments', icon: '💳' },
  { href: '/admin/users', key: 'users', icon: '👥' },
  { href: '/admin/audit', key: 'audit', icon: '📜' },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Strip the locale prefix (/en/admin/... → /admin/...) for matching.
  const path = pathname.replace(/^\/(en|si|ta)(?=\/|$)/, '') || '/';

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      router.replace('/admin/login');
    }
  }

  return (
    <div className="min-h-dvh flex">
      <aside
        className="w-60 shrink-0 border-r flex flex-col justify-between px-3 py-6 sticky top-0 h-dvh bg-surface-raised"
        style={{ borderColor: 'var(--mq-line)' }}
      >
        <div className="flex flex-col gap-1">
          <div className="px-3 pb-5 flex items-center justify-between">
            <div>
              <p className="font-extrabold text-base tracking-tight text-primary-700">MedQueue</p>
              <p className="text-xs text-muted font-medium">Admin Operations</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 font-bold">
              Admin
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active =
                item.href === '/admin' ? path === '/admin' : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-card px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2.5',
                    active
                      ? 'bg-primary-700 text-white font-semibold shadow-xs'
                      : 'text-ink hover:bg-surface-sunken',
                  )}
                >
                  <span>{item.icon}</span>
                  <span>{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Sign Out and Patient Portal link */}
        <div className="pt-4 border-t border-line flex flex-col gap-2 px-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-xs text-danger-600 hover:text-danger-700 hover:bg-danger-50"
          >
            ← Sign Out
          </Button>
          <Link
            href="/"
            className="text-[11px] text-muted hover:text-primary-700 hover:underline px-2"
          >
            ↗ Go to Patient Portal
          </Link>
        </div>
      </aside>
      <div className="flex-1 min-w-0 px-8 py-8">{children}</div>
    </div>
  );
}
