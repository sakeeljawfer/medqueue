'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Dialog, Skeleton, useToast } from '@medqueue/ui';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useQueueSocket } from '@/lib/queue-socket';
import { MorphNumber } from '@/components/morph-number';

type AppointmentStatus = 'BOOKED' | 'IN_CONSULT' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

interface AppointmentRow {
  id: string;
  tokenNumber: number;
  status: AppointmentStatus;
  patient: { name: string | null; phone: string };
}

const STATUS_TONE: Record<AppointmentStatus, 'live' | 'success' | 'danger' | 'neutral'> = {
  BOOKED: 'neutral',
  IN_CONSULT: 'live',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
};

export default function SessionConsole({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const t = useTranslations('doctorConsole');
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const live = useQueueSocket(sessionId);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['console-appointments', sessionId],
    queryFn: () => api<AppointmentRow[]>(`/sessions/${sessionId}/appointments`),
    // The socket is the trigger for refetches; this is the safety net.
    refetchInterval: 30_000,
  });
  const { data: detail } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () =>
      api<{ status: string; currentToken: number; dispensary: { name: string; town: string } }>(
        `/sessions/${sessionId}`,
      ),
  });

  const act = useMutation({
    mutationFn: (action: 'next' | 'no-show' | 'pause' | 'resume' | 'end') =>
      api<{ queueEmpty?: boolean } | undefined>(`/sessions/${sessionId}/${action}`, {
        method: 'POST',
      }),
    onSuccess: (result, action) => {
      void queryClient.invalidateQueries({ queryKey: ['console-appointments', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      if (action === 'end') router.replace('/doctor');
      else if (action === 'next' && result?.queueEmpty) {
        toast({ title: t('queueEmpty') });
      }
    },
    onError: () => toast({ title: t('actionFailed'), tone: 'error' }),
  });

  const state = live.state;
  const status = state?.status ?? detail?.status ?? 'LIVE';
  const currentToken = state?.currentToken ?? detail?.currentToken ?? 0;
  const paused = status === 'PAUSED';
  const waiting = appointments?.filter((a) => a.status === 'BOOKED').length ?? 0;

  return (
    <main className="min-h-dvh max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">
            {detail ? `${detail.dispensary.name}, ${detail.dispensary.town}` : t('sessionConsole')}
          </h1>
          <p className="text-sm text-muted" aria-live="polite">
            {live.connected ? t('liveUpdates') : t('reconnecting')}
          </p>
        </div>
        <Badge tone={paused ? 'neutral' : 'live'}>{paused ? t('pausedBadge') : t('liveBadge')}</Badge>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_minmax(280px,0.9fr)]">
        {/* Left: the big token + controls */}
        <Card className="flex flex-col items-center gap-6 py-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              {t('nowServing')}
            </p>
            <div className="mq-token mq-token--display text-primary-700" aria-live="polite">
              <MorphNumber value={currentToken} />
            </div>
            <p className="text-sm text-muted mq-tabular">
              {t('waitingCount', { count: waiting })}
              {state ? ` · ${t('avgConsult')} ${state.avgConsultMinutes} ${t('min')}` : ''}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button
              size="lg"
              disabled={paused || act.isPending}
              loading={act.isPending && act.variables === 'next'}
              onClick={() => act.mutate('next')}
            >
              {t('nextPatient')}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                disabled={paused || act.isPending || currentToken === 0}
                onClick={() => act.mutate('no-show')}
              >
                {t('noShow')}
              </Button>
              <Button
                variant="secondary"
                disabled={act.isPending}
                onClick={() => act.mutate(paused ? 'resume' : 'pause')}
              >
                {paused ? t('resume') : t('pause')}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
              {t('endSession')}
            </Button>
          </div>
        </Card>

        {/* Right: patient list */}
        <Card padded={false} className="overflow-hidden">
          <h2 className="px-5 py-3 text-sm font-semibold border-b" style={{ borderColor: 'var(--mq-line)' }}>
            {t('patients')}
          </h2>
          {isLoading ? (
            <div className="p-5 flex flex-col gap-3">
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : !appointments?.length ? (
            <p className="p-5 text-sm text-muted">{t('noBookingsYet')}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--mq-line)' }}>
              {appointments.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-center gap-4">
                  <span className="mq-token mq-token--md w-10 text-center shrink-0">
                    {String(a.tokenNumber).padStart(2, '0')}
                  </span>
                  <span className="flex-1 min-w-0 text-sm truncate">
                    {a.patient.name ?? a.patient.phone}
                  </span>
                  <Badge tone={STATUS_TONE[a.status]}>{t(`status.${a.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t('endConfirm.title')}
        description={t('endConfirm.body', { count: waiting })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
              {t('endConfirm.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={act.isPending && act.variables === 'end'}
              onClick={() => act.mutate('end')}
            >
              {t('endConfirm.confirm')}
            </Button>
          </>
        }
      />
    </main>
  );
}
