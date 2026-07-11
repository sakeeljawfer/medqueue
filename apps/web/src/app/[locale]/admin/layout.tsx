'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { cn } from '@medqueue/ui';

const NAV = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/doctors', key: 'doctors' },
  { href: '/admin/payments', key: 'payments' },
  { href: '/admin/users', key: 'users' },
  { href: '/admin/audit', key: 'audit' },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  // Strip the locale prefix (/en/admin/... → /admin/...) for matching.
  const path = pathname.replace(/^\/(en|si|ta)(?=\/|$)/, '') || '/';

  return (
    <div className="min-h-dvh flex">
      <aside
        className="w-56 shrink-0 border-r flex flex-col gap-1 px-3 py-6 sticky top-0 h-dvh"
        style={{ borderColor: 'var(--mq-line)', background: 'var(--mq-surface-raised)' }}
      >
        <p className="px-3 pb-4 font-bold tracking-tight text-primary-700">MedQueue · {t('admin')}</p>
        {NAV.map((item) => {
          const active =
            item.href === '/admin' ? path === '/admin' : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-card px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary-700 text-white' : 'text-ink hover:bg-surface-sunken',
              )}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </aside>
      <div className="flex-1 min-w-0 px-8 py-8">{children}</div>
    </div>
  );
}
