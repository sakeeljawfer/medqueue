'use client';

import { use, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Dialog, Skeleton, useToast } from '@medqueue/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError, saveAuthSession } from '@/lib/api';
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
  const [switchingDoctor, setSwitchingDoctor] = useState(false);

  const live = useQueueSocket(sessionId);

  const {
    data: appointments,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['console-appointments', sessionId],
    queryFn: () => api<AppointmentRow[]>(`/sessions/${sessionId}/appointments`),
    refetchInterval: 2_000,
    retry: 1,
  });

  const { data: detail } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () =>
      api<{
        status: string;
        currentToken: number;
        dispensary: { name: string; town: string };
        doctor?: { name: string | null };
      }>(`/sessions/${sessionId}`),
    refetchInterval: 2_000,
  });

  // Real-time synchronization when a patient books or queue changes
  useEffect(() => {
    if (live.lastUpdated || live.state) {
      void queryClient.invalidateQueries({ queryKey: ['console-appointments', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    }
  }, [live.lastUpdated, live.state, queryClient, sessionId]);

  const act = useMutation({
    mutationFn: (action: 'next' | 'no-show' | 'pause' | 'resume' | 'end') =>
      api<{ queueEmpty?: boolean; currentToken?: number } | undefined>(
        `/sessions/${sessionId}/${action}`,
        {
          method: 'POST',
        },
      ),
    onSuccess: (result, action) => {
      void queryClient.invalidateQueries({ queryKey: ['console-appointments', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      if (action === 'end') {
        toast({ title: 'Session ended successfully', tone: 'default' });
        router.replace('/doctor');
      } else if (action === 'next') {
        if (result?.queueEmpty) {
          toast({ title: t('queueEmpty') });
        } else if (result?.currentToken) {
          toast({ title: `Serving Token #${result.currentToken}`, tone: 'success' });
        }
      }
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
        toast({
          title: 'Doctor authentication required. Click "1-Click Doctor Switch".',
          tone: 'error',
        });
      } else {
        toast({ title: t('actionFailed'), tone: 'error' });
      }
    },
  });

  async function handleDoctorQuickSwitch() {
    setSwitchingDoctor(true);
    try {
      // 1-Click switch to Demo Doctor
      const res = await api<{ id: string; role: string; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: '+94777000001', password: '751234567V' }),
      });
      if (res.accessToken) {
        saveAuthSession(res.role, res.accessToken);
      }
      toast({ title: 'Signed in as Dr. Nimal Perera', tone: 'success' });
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ['console-appointments', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    } catch {
      toast({ title: 'Could not switch to Doctor session', tone: 'error' });
    } finally {
      setSwitchingDoctor(false);
    }
  }

  const isAuthError = error instanceof ApiError && (error.status === 403 || error.status === 401);

  const state = live.state;
  const status = state?.status ?? detail?.status ?? 'LIVE';
  const currentToken = state?.currentToken ?? detail?.currentToken ?? 0;
  const paused = status === 'PAUSED';
  const waiting = appointments?.filter((a) => a.status === 'BOOKED').length ?? 0;

  return (
    <main className="min-h-dvh max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-line">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/doctor"
              className="text-xs font-semibold text-primary-700 hover:underline flex items-center gap-1"
            >
              ← Doctor Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight truncate">
            {detail ? `${detail.dispensary.name}, ${detail.dispensary.town}` : t('sessionConsole')}
          </h1>
          <p className="text-sm text-muted" aria-live="polite">
            {live.connected ? t('liveUpdates') : t('reconnecting')}
            {detail?.doctor?.name ? ` · ${detail.doctor.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={paused ? 'neutral' : 'live'}>{paused ? t('pausedBadge') : t('liveBadge')}</Badge>
          <Button
            size="sm"
            variant="secondary"
            loading={switchingDoctor}
            onClick={handleDoctorQuickSwitch}
            className="text-xs"
          >
            ⚡ Doctor Mode
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-[1fr_minmax(300px,0.9fr)]">
        {/* Left: Token Display & Doctor Controls */}
        <Card className="flex flex-col items-center gap-6 py-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              {t('nowServing')}
            </p>
            <div className="mq-token mq-token--display text-primary-700 my-2" aria-live="polite">
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
              className="font-bold shadow-sm"
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

        {/* Right: Patient Queue List */}
        <Card padded={false} className="overflow-hidden flex flex-col min-h-[380px]">
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--mq-line)' }}>
            <h2 className="text-sm font-semibold text-ink">
              {t('patients')} {appointments ? `(${appointments.length})` : ''}
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted font-medium">Live sync</span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-5 flex flex-col gap-3">
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </div>
          ) : isAuthError ? (
            <div className="p-6 flex flex-col items-center justify-center text-center gap-3 my-auto">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold text-xl">
                🔒
              </div>
              <h3 className="font-bold text-ink">Doctor Session Auth Required</h3>
              <p className="text-xs text-muted max-w-xs leading-relaxed">
                You are currently viewing this console without active doctor credentials for this session.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <Button
                  size="sm"
                  loading={switchingDoctor}
                  onClick={handleDoctorQuickSwitch}
                  className="font-semibold"
                >
                  ⚡ 1-Click Doctor Switch (Dr. Nimal)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push('/doctor/login')}
                >
                  Sign In With Credentials
                </Button>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center my-auto flex flex-col gap-3">
              <p className="text-sm text-danger-600 font-medium">Failed to load appointments</p>
              <Button size="sm" variant="secondary" onClick={() => refetch()} className="mx-auto">
                Retry
              </Button>
            </div>
          ) : !appointments || appointments.length === 0 ? (
            <div className="p-8 text-center my-auto flex flex-col items-center gap-2">
              <p className="text-2xl">⏳</p>
              <p className="text-sm text-muted max-w-xs">{t('noBookingsYet')}</p>
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--mq-line)' }}>
              {appointments.map((a) => {
                const isServing = a.status === 'IN_CONSULT';
                return (
                  <li
                    key={a.id}
                    className={`px-5 py-3.5 flex items-center gap-4 transition-colors ${
                      isServing ? 'bg-primary-50/70 dark:bg-primary-950/30 font-medium' : ''
                    }`}
                  >
                    <span
                      className={`mq-token mq-token--md w-11 text-center shrink-0 ${
                        isServing ? 'bg-primary-700 text-white font-bold' : ''
                      }`}
                    >
                      {String(a.tokenNumber).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate text-ink">
                          {a.patient.name || `Patient #${a.tokenNumber}`}
                        </span>
                        {isServing && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-primary-100 dark:bg-primary-900/60 px-1.5 py-0.5 rounded">
                            Serving now
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted font-mono">{a.patient.phone}</span>
                    </div>
                    <Badge tone={STATUS_TONE[a.status]}>{t(`status.${a.status}`)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* End Session Confirmation */}
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
