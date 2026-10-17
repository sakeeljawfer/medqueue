'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LiveIndicator,
  Skeleton,
} from '@medqueue/ui';
import { DISTRICTS, formatLKR, type Locale } from '@medqueue/shared';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { PatientHeader } from '@/components/patient-header';

interface SearchResult {
  dispensaryId: string;
  dispensaryName: string;
  town: string;
  district: string;
  doctorId: string;
  doctorName: string | null;
  specialty: string;
  consultationFeeLKR: string;
  photoUrl: string | null;
  verified: boolean;
  live: boolean;
  liveSessionId: string | null;
  distanceKm: number | null;
  nextSession: { id: string; date: string; startTime: string; status: string } | null;
}

interface AppointmentRow {
  id: string;
  sessionId: string;
  tokenNumber: number;
  status: 'BOOKED' | 'IN_CONSULT' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  session: {
    status: string;
    date: string;
    schedule: {
      dispensary: {
        name: string;
        town: string;
        doctor: { user: { name: string | null } };
      };
    };
  };
}

const FEATURED_DISTRICTS = ['colombo', 'gampaha', 'kandy', 'galle', 'kurunegala', 'jaffna'];

export default function HomePage() {
  const t = useTranslations('home');
  const tSpecialty = useTranslations('specialty');
  const locale = useLocale() as Locale;

  const [q, setQ] = useState('');
  const [district, setDistrict] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (district) params.set('district', district);
  if (geo) {
    params.set('lat', String(geo.lat));
    params.set('lng', String(geo.lng));
    params.set('radiusKm', '15');
  }

  const { data, isLoading } = useQuery({
    queryKey: ['search', q, district, geo],
    queryFn: () => api<SearchResult[]>(`/search/doctors?${params.toString()}`),
  });

  const { data: myAppointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api<AppointmentRow[]>('/appointments'),
    retry: false,
    staleTime: 15_000,
  });

  const activeTicket = myAppointments?.find(
    (a) => a.status === 'BOOKED' || a.status === 'IN_CONSULT',
  );

  function nearMe(): void {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDistrict(null);
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGeo(null),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pb-20 pt-4 flex flex-col gap-5">
      <PatientHeader />

      {/* Active Live Ticket Banner if patient holds a booked token */}
      {activeTicket && (
        <Card className="border-primary-700/30 bg-primary-50/50 flex items-center justify-between gap-3 p-3.5 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 rounded-card bg-primary-700 text-white flex flex-col items-center justify-center font-bold">
              <span className="text-[9px] uppercase tracking-wider opacity-80 leading-none">Token</span>
              <span className="text-base leading-none font-black">{activeTicket.tokenNumber}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-xs truncate text-ink">
                  {activeTicket.session.schedule.dispensary.doctor.user.name ?? 'Doctor'}
                </p>
                {activeTicket.session.status === 'LIVE' && <LiveIndicator label="Live" />}
              </div>
              <p className="text-[11px] text-muted truncate">
                {activeTicket.session.schedule.dispensary.name}, {activeTicket.session.schedule.dispensary.town}
              </p>
            </div>
          </div>
          <Link href={`/ticket/${activeTicket.sessionId}`} className="shrink-0">
            <Button size="sm" variant="primary">
              View Ticket
            </Button>
          </Link>
        </Card>
      )}

      {/* Hero Search Box */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-bold tracking-tight text-ink">{t('title')}</h1>
          <p className="text-xs text-muted">{t('tagline')}</p>
        </div>
        <input
          className="mq-input text-sm"
          placeholder={t('searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('searchPlaceholder')}
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          <Button size="sm" variant={geo ? 'primary' : 'secondary'} onClick={nearMe}>
            📍 {t('nearMe')}
          </Button>
          {FEATURED_DISTRICTS.map((slug) => {
            const d = DISTRICTS.find((x) => x.slug === slug)!;
            return (
              <Button
                key={slug}
                size="sm"
                variant={district === slug ? 'primary' : 'secondary'}
                onClick={() => {
                  setGeo(null);
                  setDistrict(district === slug ? null : slug);
                }}
              >
                {d[locale]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Doctor & Dispensary Results */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="flex gap-3 items-center">
              <Skeleton width={48} height={48} className="rounded-full" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton height={16} width="60%" />
                <Skeleton height={12} width="40%" />
              </div>
            </Card>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<span aria-hidden>⌕</span>}
          title={t('empty.title')}
          body={t('empty.body')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((r) => (
            <li key={`${r.doctorId}:${r.dispensaryId}`}>
              <Link href={`/doctors/${r.doctorId}`} className="block">
                <Card interactive className="flex gap-3 items-center">
                  <Avatar src={r.photoUrl} name={r.doctorName ?? 'Dr'} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{r.doctorName}</span>
                      {r.verified && <Badge tone="verified">{t('verified')}</Badge>}
                    </div>
                    <p className="text-xs text-muted truncate">
                      {tSpecialty(r.specialty as never)} · {r.dispensaryName}, {r.town}
                      {r.distanceKm !== null && ` · ${r.distanceKm} km`}
                    </p>
                    <p className="text-xs font-semibold text-primary-700 mt-0.5">
                      {formatLKR(Number(r.consultationFeeLKR))}
                    </p>
                  </div>
                  {r.live ? (
                    <LiveIndicator label={t('liveNow')} />
                  ) : r.nextSession ? (
                    <Badge tone="neutral">{r.nextSession.startTime}</Badge>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Subtle Patient Footer */}
      <footer className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
        <span>© MedQueue LK · Real-time dispensary queues</span>
        <div className="flex items-center gap-2.5">
          <Link href="/doctor/login" className="hover:text-primary-700 hover:underline">
            Doctor Sign In
          </Link>
          <span>·</span>
          <Link href="/admin/login" className="hover:text-primary-700 hover:underline">
            Admin Portal
          </Link>
        </div>
      </footer>
    </main>
  );
}
