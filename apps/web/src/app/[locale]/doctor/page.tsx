'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, Skeleton, useToast } from '@medqueue/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

interface ScheduleRow {
  id: string;
  startTime: string;
  endTime: string;
  maxPatients: number;
  avgConsultMinutes: number;
  session: {
    id: string;
    status: 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED';
    currentToken: number;
    _count: { appointments: number };
  } | null;
}

interface DispensaryRow {
  id: string;
  name: string;
  town: string;
  schedules: ScheduleRow[];
}

export default function DoctorDashboard() {
  const t = useTranslations('doctorConsole');
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['doctor-today'],
    queryFn: () => api<DispensaryRow[]>('/sessions/mine/today'),
    retry: false,
  });

  const start = useMutation({
    mutationFn: (scheduleId: string) =>
      api<{ id: string }>('/sessions/start', {
        method: 'POST',
        body: JSON.stringify({ scheduleId }),
      }),
    onSuccess: (session) => router.push(`/doctor/console/${session.id}`),
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : 'generic';
      toast({
        title: code === 'doctor_not_approved' ? t('notApproved') : t('startFailed'),
        tone: 'error',
      });
      void queryClient.invalidateQueries({ queryKey: ['doctor-today'] });
    },
  });

  if (error instanceof ApiError && error.status === 401) {
    router.replace('/login');
    return null;
  }

  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('todaysSessions')}</h1>
        <Link href="/doctor/payments" className="text-sm font-semibold text-primary-700">
          {t('payments')}
        </Link>
      </header>

      {isLoading ? (
        <Skeleton height={140} />
      ) : error instanceof ApiError && error.code === 'doctor_profile_not_found' ? (
        <EmptyState title={t('noProfile.title')} body={t('noProfile.body')} />
      ) : !data || data.every((d) => d.schedules.length === 0) ? (
        <EmptyState title={t('noSessions.title')} body={t('noSessions.body')} />
      ) : (
        data.map((dispensary) =>
          dispensary.schedules.map((schedule) => {
            const session = schedule.session;
            const live = session?.status === 'LIVE' || session?.status === 'PAUSED';
            return (
              <Card key={schedule.id} className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">
                    {dispensary.name}, {dispensary.town}
                  </h2>
                  <p className="text-sm text-muted mq-tabular">
                    {schedule.startTime}–{schedule.endTime} · {t('maxPatients', { max: schedule.maxPatients })}
                  </p>
                  {session && (
                    <p className="text-sm mt-1">
                      <Badge tone={live ? 'live' : 'neutral'}>{session.status}</Badge>{' '}
                      <span className="text-muted">
                        {t('bookings', { count: session._count.appointments })}
                      </span>
                    </p>
                  )}
                </div>
                {live ? (
                  <Button size="lg" onClick={() => router.push(`/doctor/console/${session!.id}`)}>
                    {t('openConsole')}
                  </Button>
                ) : session?.status === 'ENDED' ? (
                  <Badge tone="neutral">{t('ended')}</Badge>
                ) : (
                  <Button
                    size="lg"
                    loading={start.isPending}
                    onClick={() => start.mutate(schedule.id)}
                  >
                    {t('startSession')}
                  </Button>
                )}
              </Card>
            );
          }),
        )
      )}
    </main>
  );
}
