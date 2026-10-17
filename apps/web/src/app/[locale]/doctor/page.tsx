'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Dialog, EmptyState, Skeleton, TextField, useToast } from '@medqueue/ui';
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

  // Create session modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [dispensaryId, setDispensaryId] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('20:00');
  const [maxPatients, setMaxPatients] = useState('50');
  const [avgConsultMinutes, setAvgConsultMinutes] = useState('10');
  const [autoStart, setAutoStart] = useState(true);

  // End session modal state
  const [endSessionId, setEndSessionId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['doctor-today'],
    queryFn: () => api<DispensaryRow[]>('/sessions/mine/today'),
    retry: false,
  });

  const { data: dispensaries } = useQuery({
    queryKey: ['doctor-dispensaries'],
    queryFn: () => api<Array<{ id: string; name: string; town: string }>>('/sessions/mine/dispensaries'),
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

  const createSessionMutation = useMutation({
    mutationFn: (dto: {
      dispensaryId?: string;
      startTime: string;
      endTime: string;
      maxPatients: number;
      avgConsultMinutes: number;
      autoStart: boolean;
    }) =>
      api<{ id: string }>('/sessions/create', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: (session) => {
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['doctor-today'] });
      if (autoStart && session?.id) {
        toast({ title: 'Session created and started live!', tone: 'success' });
        router.push(`/doctor/console/${session.id}`);
      } else {
        toast({ title: 'Session scheduled successfully!', tone: 'success' });
      }
    },
    onError: () => {
      toast({ title: 'Failed to create session. Please check details.', tone: 'error' });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api(`/sessions/${sessionId}/end`, {
        method: 'POST',
      }),
    onSuccess: () => {
      setEndSessionId(null);
      toast({ title: 'Session ended successfully.', tone: 'default' });
      void queryClient.invalidateQueries({ queryKey: ['doctor-today'] });
    },
    onError: () => {
      toast({ title: 'Could not end the session. Please try again.', tone: 'error' });
    },
  });

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    router.replace('/doctor/login');
    return null;
  }

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      router.replace('/doctor/login');
    }
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    createSessionMutation.mutate({
      dispensaryId: dispensaryId || undefined,
      startTime,
      endTime,
      maxPatients: Number(maxPatients) || 50,
      avgConsultMinutes: Number(avgConsultMinutes) || 10,
      autoStart,
    });
  }

  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-line gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href="/doctor" className="font-extrabold text-primary-700 text-lg tracking-tight">
            MedQueue
          </Link>
          <Badge tone="live">Doctor Console</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Button size="sm" onClick={() => setCreateOpen(true)} className="font-bold">
            + Create Session
          </Button>
          <Link href="/doctor/payments" className="text-muted hover:text-ink font-medium">
            {t('payments')}
          </Link>
          <Button size="sm" variant="ghost" onClick={handleLogout} className="text-xs">
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      {isLoading ? (
        <Skeleton height={140} />
      ) : error instanceof ApiError && error.code === 'doctor_profile_not_found' ? (
        <EmptyState
          title={t('noProfile.title')}
          body={t('noProfile.body')}
          action={
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              Register Dispensary & Session
            </Button>
          }
        />
      ) : !data || data.every((d) => d.schedules.length === 0) ? (
        <EmptyState
          title="No Sessions Scheduled Today"
          body="Start seeing patients by creating a dispensary session for today."
          action={
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              + Create Session Now
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Today&apos;s Sessions</h2>
            <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
              + Add Session
            </Button>
          </div>

          {data.map((dispensary) =>
            dispensary.schedules.map((schedule) => {
              const session = schedule.session;
              const live = session?.status === 'LIVE' || session?.status === 'PAUSED';
              return (
                <Card key={schedule.id} className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="font-semibold text-ink">
                      {dispensary.name}, {dispensary.town}
                    </h2>
                    <p className="text-sm text-muted mq-tabular">
                      {schedule.startTime}–{schedule.endTime} · {t('maxPatients', { max: schedule.maxPatients })}
                    </p>
                    {session && (
                      <p className="text-sm mt-1.5 flex items-center gap-2">
                        <Badge tone={live ? 'live' : session.status === 'ENDED' ? 'neutral' : 'verified'}>
                          {session.status}
                        </Badge>
                        <span className="text-muted text-xs">
                          {t('bookings', { count: session._count.appointments })}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {live ? (
                      <>
                        <Button size="md" onClick={() => router.push(`/doctor/console/${session!.id}`)}>
                          {t('openConsole')}
                        </Button>
                        <Button
                          size="md"
                          variant="danger"
                          onClick={() => setEndSessionId(session!.id)}
                        >
                          End Session
                        </Button>
                      </>
                    ) : session?.status === 'ENDED' ? (
                      <Badge tone="neutral">{t('ended')}</Badge>
                    ) : (
                      <Button
                        size="md"
                        loading={start.isPending}
                        onClick={() => start.mutate(schedule.id)}
                      >
                        {t('startSession')}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            }),
          )}
        </div>
      )}

      {/* Dialog: Create Session */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Dispensary Session"
        description="Set up and launch a queue session for today."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-session-form"
              loading={createSessionMutation.isPending}
            >
              {autoStart ? 'Create & Go Live' : 'Create Session'}
            </Button>
          </>
        }
      >
        <form id="create-session-form" onSubmit={handleCreateSubmit} className="flex flex-col gap-4 py-2">
          {dispensaries && dispensaries.length > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-semibold text-ink">Dispensary</label>
              <select
                value={dispensaryId}
                onChange={(e) => setDispensaryId(e.target.value)}
                className="h-10 px-3 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                {dispensaries.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.town})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <TextField
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Max Patients"
              type="number"
              min={5}
              max={200}
              value={maxPatients}
              onChange={(e) => setMaxPatients(e.target.value)}
              required
            />
            <TextField
              label="Avg Consult (min)"
              type="number"
              min={3}
              max={60}
              value={avgConsultMinutes}
              onChange={(e) => setAvgConsultMinutes(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="w-4 h-4 rounded text-primary-700"
            />
            <span>Start session immediately (Go Live now)</span>
          </label>
        </form>
      </Dialog>

      {/* Dialog: Confirm End Session */}
      <Dialog
        open={Boolean(endSessionId)}
        onOpenChange={(open) => !open && setEndSessionId(null)}
        title="End this Session?"
        description="Are you sure you want to end this active session? The queue will be closed and any remaining unserved bookings will be reconciled."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndSessionId(null)}>
              Keep Session Active
            </Button>
            <Button
              variant="danger"
              loading={endSessionMutation.isPending}
              onClick={() => endSessionId && endSessionMutation.mutate(endSessionId)}
            >
              Confirm & End Session
            </Button>
          </>
        }
      />
    </main>
  );
}
