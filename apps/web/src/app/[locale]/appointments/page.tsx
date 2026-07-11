'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, EmptyState, Skeleton, TokenNumber } from '@medqueue/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

interface AppointmentRow {
  id: string;
  sessionId: string;
  tokenNumber: number;
  status: 'BOOKED' | 'IN_CONSULT' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  bookedAt: string;
  session: {
    date: string;
    status: string;
    schedule: {
      startTime: string;
      dispensary: {
        name: string;
        town: string;
        doctor: { user: { name: string | null } };
      };
    };
  };
}

const STATUS_TONE = {
  BOOKED: 'live',
  IN_CONSULT: 'live',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
} as const;

export default function AppointmentsPage() {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api<AppointmentRow[]>('/appointments'),
    retry: false,
  });

  if (error instanceof ApiError && error.status === 401) {
    router.replace('/login');
    return null;
  }

  const active = (data ?? []).filter((a) => a.status === 'BOOKED' || a.status === 'IN_CONSULT');
  const history = (data ?? []).filter((a) => a.status !== 'BOOKED' && a.status !== 'IN_CONSULT');

  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pb-24 pt-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <Link href="/" className="text-sm font-semibold text-primary-700">
          {t('findDoctor')}
        </Link>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={88} />
          <Skeleton height={88} />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<span aria-hidden>🎫</span>}
          title={t('empty.title')}
          body={t('empty.body')}
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                {t('upcoming')}
              </h2>
              {active.map((a) => (
                <Link key={a.id} href={`/ticket/${a.sessionId}`} className="block">
                  <Card interactive className="flex items-center gap-4">
                    <TokenNumber value={a.tokenNumber} size="lg" className="text-primary-700" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {a.session.schedule.dispensary.doctor.user.name}
                      </p>
                      <p className="text-sm text-muted truncate">
                        {a.session.schedule.dispensary.name},{' '}
                        {a.session.schedule.dispensary.town}
                      </p>
                      <p className="text-sm text-muted">
                        {new Date(a.session.date).toLocaleDateString(locale, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · {a.session.schedule.startTime}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[a.status]}>{t(`status.${a.status}` as never)}</Badge>
                  </Card>
                </Link>
              ))}
            </section>
          )}

          {history.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                {t('history')}
              </h2>
              {history.map((a) => (
                <Card key={a.id} className="flex items-center gap-4 opacity-80">
                  <TokenNumber value={a.tokenNumber} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a.session.schedule.dispensary.doctor.user.name}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(a.session.date).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[a.status]}>{t(`status.${a.status}` as never)}</Badge>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
