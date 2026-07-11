'use client';

import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Avatar, Badge, Button, Card, LiveIndicator, Skeleton, useToast } from '@medqueue/ui';
import { DISTRICTS, formatLKR, type Locale } from '@medqueue/shared';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

const DispensaryMap = dynamic(() => import('@/components/dispensary-map'), {
  ssr: false,
  loading: () => <Skeleton height={220} />,
});

interface DoctorDetail {
  id: string;
  name: string | null;
  specialty: string;
  bio: string | null;
  consultationFeeLKR: string;
  verified: boolean;
  photoUrl: string | null;
  dispensaries: Array<{
    id: string;
    name: string;
    addressLine: string;
    town: string;
    district: string;
    lat: number;
    lng: number;
    schedules: Array<{
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      maxPatients: number;
    }>;
  }>;
}

interface SessionRow {
  id: string;
  date: string;
  status: 'SCHEDULED' | 'LIVE' | 'PAUSED';
  currentToken: number;
  schedule: { startTime: string; endTime: string; maxPatients: number; dispensaryId: string };
  _count: { appointments: number };
}

export default function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('doctor');
  const tDays = useTranslations('days');
  const tSpecialty = useTranslations('specialty');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [bookingSessionId, setBookingSessionId] = useState<string | null>(null);

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor', id],
    queryFn: () => api<DoctorDetail>(`/search/doctors/${id}`),
  });

  const { data: sessions } = useQuery({
    queryKey: ['doctor-sessions', id],
    queryFn: () => api<SessionRow[]>(`/sessions?doctorId=${id}`),
  });

  const book = useMutation({
    mutationFn: (sessionId: string) =>
      api<{ tokenNumber: number }>(`/appointments/sessions/${sessionId}/book`, {
        method: 'POST',
      }),
    onSuccess: (appt, sessionId) => {
      toast({ title: t('booked', { token: appt.tokenNumber }), tone: 'success' });
      router.push(`/ticket/${sessionId}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 401) {
        router.push('/login');
        return;
      }
      const code = e instanceof ApiError ? e.code : 'generic';
      toast({ title: t.has(`errors.${code}` as never) ? t(`errors.${code}` as never) : t('errors.generic'), tone: 'error' });
    },
    onSettled: () => setBookingSessionId(null),
  });

  if (isLoading || !doctor) {
    return (
      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        <Skeleton height={72} />
        <Skeleton height={220} />
        <Skeleton height={120} />
      </main>
    );
  }

  const districtName = (slug: string): string =>
    DISTRICTS.find((d) => d.slug === slug)?.[locale] ?? slug;

  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pb-24 pt-6 flex flex-col gap-5">
      <button onClick={() => router.back()} className="text-sm text-primary-700 font-semibold self-start">
        ← {t('back')}
      </button>

      <header className="flex items-center gap-4">
        <Avatar src={doctor.photoUrl} name={doctor.name ?? 'Dr'} size={64} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{doctor.name}</h1>
            {doctor.verified && <Badge tone="verified">{t('slmcVerified')}</Badge>}
          </div>
          <p className="text-muted text-sm">{tSpecialty(doctor.specialty as never)}</p>
          <p className="text-sm font-semibold">{formatLKR(Number(doctor.consultationFeeLKR))}</p>
        </div>
      </header>

      {doctor.bio && <p className="text-sm text-muted">{doctor.bio}</p>}

      <DispensaryMap points={doctor.dispensaries} />

      {doctor.dispensaries.map((d) => {
        const dispSessions = (sessions ?? []).filter(
          (s) => s.schedule.dispensaryId === d.id,
        );
        return (
          <Card key={d.id} className="flex flex-col gap-3">
            <div>
              <h2 className="font-semibold">{d.name}</h2>
              <p className="text-sm text-muted">
                {d.addressLine}, {d.town} · {districtName(d.district)}
              </p>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              {d.schedules.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{tDays(String(s.dayOfWeek) as never)}</span>
                  <span className="mq-tabular">
                    {s.startTime}–{s.endTime}
                  </span>
                </div>
              ))}
            </div>

            {dispSessions.map((s) => {
              const full = s._count.appointments >= s.schedule.maxPatients;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-t border-line pt-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {new Date(s.date).toLocaleDateString(locale, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {s.schedule.startTime}
                    </span>
                    <span className="text-xs text-muted">
                      {t('slots', {
                        booked: s._count.appointments,
                        max: s.schedule.maxPatients,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === 'LIVE' && <LiveIndicator label={t('live')} />}
                    <Button
                      size="sm"
                      disabled={full}
                      loading={book.isPending && bookingSessionId === s.id}
                      onClick={() => {
                        setBookingSessionId(s.id);
                        book.mutate(s.id);
                      }}
                    >
                      {full ? t('full') : t('getToken')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </main>
  );
}
