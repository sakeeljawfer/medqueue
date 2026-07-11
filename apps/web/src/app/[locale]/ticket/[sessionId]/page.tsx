'use client';

import { use, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Skeleton } from '@medqueue/ui';
import type { QueueState, QueueYou } from '@medqueue/shared';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useQueueSocket } from '@/lib/queue-socket';
import { MorphNumber } from '@/components/morph-number';

interface Ticket {
  state: QueueState;
  you: QueueYou;
}

interface SessionDetail {
  doctor: { name: string | null };
  dispensary: { name: string; town: string };
  startTime: string;
}

export default function TicketPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const t = useTranslations('ticket');
  const router = useRouter();

  const { data: initial } = useQuery({
    queryKey: ['ticket', sessionId],
    queryFn: () => api<Ticket>(`/appointments/sessions/${sessionId}/ticket`),
    refetchInterval: 60_000, // slow safety net; the socket is the fast path
  });
  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api<SessionDetail>(`/sessions/${sessionId}`),
  });

  const live = useQueueSocket(sessionId);
  const state = live.state ?? initial?.state ?? null;
  const you = live.you ?? initial?.you ?? null;

  const rail = useMemo(() => {
    if (!state || !you) return [];
    const between = Math.max(0, you.position);
    // Show up to 8 dots between "now serving" and you.
    return Array.from({ length: Math.min(between, 8) });
  }, [state, you]);

  if (!state || !you) {
    return (
      <main className="max-w-md mx-auto px-4 py-8 flex flex-col gap-4">
        <Skeleton height={320} />
        <Skeleton height={80} />
      </main>
    );
  }

  const isYourTurn = state.currentToken === you.yourToken && you.status === 'IN_CONSULT';
  const sessionOver = state.status === 'ENDED' || state.status === 'CANCELLED';

  return (
    <main className="min-h-dvh max-w-md mx-auto px-4 pb-16 pt-6 flex flex-col gap-5">
      <button
        onClick={() => router.push('/appointments')}
        className="text-sm text-primary-700 font-semibold self-start"
      >
        ← {t('myAppointments')}
      </button>

      {/* The ticket — styled like a physical dispensary token */}
      <Card padded={false} className="overflow-hidden">
        <div className="bg-primary-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-semibold truncate">{session?.doctor.name ?? '—'}</p>
            <p className="text-sm opacity-80 truncate">
              {session ? `${session.dispensary.name}, ${session.dispensary.town}` : ''}
            </p>
          </div>
          {state.status === 'LIVE' && (
            <span className="mq-badge mq-badge--live" role="status">
              <span className="mq-live-dot" aria-hidden /> {t('live')}
            </span>
          )}
          {state.status === 'PAUSED' && <Badge tone="neutral">{t('paused')}</Badge>}
          {sessionOver && <Badge tone="danger">{t('ended')}</Badge>}
        </div>

        <div className="px-6 py-8 flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {t('yourToken')}
          </p>
          <div className="mq-token mq-token--display text-primary-700" aria-live="polite">
            <MorphNumber value={you.yourToken} />
          </div>

          {isYourTurn ? (
            <p className="mt-2 text-lg font-bold text-live-600">{t('yourTurn')}</p>
          ) : you.status === 'NO_SHOW' ? (
            <div className="mt-2 flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-danger-600">{t('missed')}</p>
              <Button
                size="sm"
                onClick={async () => {
                  await api(`/appointments/sessions/${sessionId}/rejoin`, { method: 'POST' });
                  window.location.reload();
                }}
              >
                {t('rejoin')}
              </Button>
            </div>
          ) : (
            <>
              {/* Progress rail: tokens between now-serving and you */}
              <div className="mt-4 flex items-center gap-2" aria-hidden>
                <span className="mq-token mq-token--md text-live-600">
                  <MorphNumber value={state.currentToken} />
                </span>
                <div className="flex items-center gap-1.5">
                  {rail.map((_, i) => (
                    <span
                      key={i}
                      className="inline-block rounded-full"
                      style={{
                        width: 6,
                        height: 6,
                        background: 'var(--mq-line)',
                      }}
                    />
                  ))}
                  {you.position > 8 && (
                    <span className="text-xs text-muted mq-tabular">+{you.position - 8}</span>
                  )}
                </div>
                <span className="mq-token mq-token--md">{String(you.yourToken).padStart(2, '0')}</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 w-full">
                <div className="rounded-card bg-surface-sunken px-4 py-3">
                  <p className="text-xs text-muted">{t('nowServing')}</p>
                  <p className="mq-token mq-token--lg text-live-600" aria-live="polite">
                    <MorphNumber value={state.currentToken} />
                  </p>
                </div>
                <div className="rounded-card bg-surface-sunken px-4 py-3">
                  <p className="text-xs text-muted">{t('estWait')}</p>
                  <p className="mq-token mq-token--lg">
                    <MorphNumber value={you.etaMinutes} />
                    <span className="text-sm font-semibold ml-1">{t('min')}</span>
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-muted">
                {t('position', { position: you.position })}
              </p>
            </>
          )}
        </div>

        <div
          className="px-6 py-3 border-t border-dashed text-xs text-muted flex justify-between"
          style={{ borderColor: 'var(--mq-line)' }}
        >
          <span>
            {t('served')}: <span className="mq-tabular">{state.servedCount}</span>/
            <span className="mq-tabular">{state.totalBooked}</span>
          </span>
          <span>
            {t('avgConsult')}: <span className="mq-tabular">{state.avgConsultMinutes}</span> {t('min')}
          </span>
          <span aria-live="polite">{live.connected ? t('liveUpdates') : t('reconnecting')}</span>
        </div>
      </Card>

      <p className="text-center text-xs text-muted px-6">{t('arriveHint')}</p>
    </main>
  );
}
