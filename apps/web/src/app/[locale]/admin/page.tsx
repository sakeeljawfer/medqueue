'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, Skeleton } from '@medqueue/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

interface Overview {
  activeSessions: number;
  bookingsToday: number;
  pendingDoctors: number;
  pendingPayments: number;
  totalPatients: number;
}

export default function AdminOverview() {
  const t = useTranslations('admin.overview');
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api<Overview>('/admin/overview'),
    refetchInterval: 30_000,
    retry: false,
  });

  if (error instanceof ApiError && error.status === 401) {
    router.replace('/admin/login');
    return null;
  }
  if (error instanceof ApiError && error.status === 403) {
    return <p className="text-sm text-muted">{t('forbidden')}</p>;
  }

  const kpis = data
    ? ([
        { key: 'activeSessions', value: data.activeSessions, href: null, live: data.activeSessions > 0 },
        { key: 'bookingsToday', value: data.bookingsToday, href: null, live: false },
        { key: 'pendingDoctors', value: data.pendingDoctors, href: '/admin/doctors', live: false },
        { key: 'pendingPayments', value: data.pendingPayments, href: '/admin/payments', live: false },
        { key: 'totalPatients', value: data.totalPatients, href: null, live: false },
      ] as const)
    : [];

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={110} />)
          : kpis.map((kpi) => {
              const card = (
                <Card key={kpi.key} className="flex flex-col gap-1 h-full">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t(kpi.key)}
                  </p>
                  <p
                    className={`mq-token mq-token--lg ${kpi.live ? 'text-live-600' : 'text-primary-700'}`}
                  >
                    {kpi.value}
                  </p>
                </Card>
              );
              return kpi.href ? (
                <Link key={kpi.key} href={kpi.href} className="block h-full">
                  {card}
                </Link>
              ) : (
                card
              );
            })}
      </div>
    </main>
  );
}
