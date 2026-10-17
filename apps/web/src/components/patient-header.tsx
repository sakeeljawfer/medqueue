'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@medqueue/ui';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Locale } from '@medqueue/shared';

interface CurrentUser {
  id: string;
  phone: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  name: string | null;
}

interface AppointmentRow {
  id: string;
  status: string;
}

const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'si', label: 'සිං' },
  { value: 'ta', label: 'தமி' },
  { value: 'en', label: 'EN' },
];

export function PatientHeader() {
  const t = useTranslations('home');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<CurrentUser>('/me'),
    retry: false,
    staleTime: 60_000,
  });

  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api<AppointmentRow[]>('/appointments'),
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  const activeCount = (appointments ?? []).filter(
    (a) => a.status === 'BOOKED' || a.status === 'IN_CONSULT',
  ).length;

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      router.replace('/login');
    }
  }

  return (
    <header className="flex items-center justify-between pb-3 border-b border-line gap-2">
      <Link href="/" className="flex items-center gap-2 group">
        <span className="w-8 h-8 rounded-card bg-primary-700 text-white flex items-center justify-center font-black text-base shadow-xs group-hover:bg-primary-800 transition-colors">
          +
        </span>
        <div className="flex flex-col">
          <span className="text-primary-700 font-extrabold text-lg leading-tight tracking-tight">
            MedQueue
          </span>
          <span className="text-[10px] text-muted tracking-wide font-medium">Sri Lanka</span>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div className="flex items-center border border-line rounded-card p-0.5 bg-surface-sunken">
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => router.replace(pathname, { locale: opt.value })}
              className={`px-1.5 py-0.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                opt.value === locale
                  ? 'bg-white text-primary-700 shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* My Tokens button */}
        <Link
          href="/appointments"
          className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-card border border-line bg-surface-raised hover:bg-surface-sunken transition-colors"
        >
          <span>🎫</span>
          <span>{t('myAppointments')}</span>
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-live-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </Link>

        {/* User Status / Login */}
        {user ? (
          <Button size="sm" variant="ghost" onClick={handleLogout} className="text-xs">
            Logout
          </Button>
        ) : (
          <Link href="/login">
            <Button size="sm" variant="primary" className="text-xs">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

