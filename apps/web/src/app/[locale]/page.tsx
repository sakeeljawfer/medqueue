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
    <main className="min-h-dvh max-w-lg mx-auto px-4 pb-24 pt-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <span className="text-primary-700 font-extrabold text-xl tracking-tight">MedQueue</span>
        <Link href="/appointments" className="text-sm font-semibold text-primary-700">
          {t('myAppointments')}
        </Link>
      </header>

      <div className="flex flex-col gap-3">
        <input
          className="mq-input"
          placeholder={t('searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('searchPlaceholder')}
        />
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <Button size="sm" variant={geo ? 'primary' : 'secondary'} onClick={nearMe}>
            {t('nearMe')}
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

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex gap-3 items-center">
              <Skeleton width={48} height={48} radius="50%" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton width="60%" />
                <Skeleton width="40%" height={12} />
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
                      <span className="font-semibold truncate">{r.doctorName}</span>
                      {r.verified && <Badge tone="verified">{t('verified')}</Badge>}
                    </div>
                    <p className="text-sm text-muted truncate">
                      {tSpecialty(r.specialty as never)} · {r.dispensaryName}, {r.town}
                      {r.distanceKm !== null && ` · ${r.distanceKm} km`}
                    </p>
                    <p className="text-sm text-muted">
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
    </main>
  );
}
