'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, TextField, useToast } from '@medqueue/ui';
import { useRouter, usePathname } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { Locale } from '@medqueue/shared';

const LOCALE_LABELS: Array<{ value: Locale; label: string }> = [
  { value: 'si', label: 'සිංහල' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'en', label: 'English' },
];

export default function LoginPage() {
  const t = useTranslations('login');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function requestCode(): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
      setStep('code');
    } catch (e) {
      const requestCodeError = e instanceof ApiError ? `errors.${e.code}` : 'errors.generic';
      setError(t.has(requestCodeError as never) ? t(requestCodeError as never) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const result = await api<{ isNew: boolean; role: string }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          code,
          name: name || undefined,
          preferredLanguage: locale,
          pdpaConsent: consent || undefined,
        }),
      });
      toast({ title: t('welcome'), tone: 'success' });
      router.replace('/');
      void result;
    } catch (e) {
      const apiCode = e instanceof ApiError ? e.code : 'generic';
      if (apiCode === 'pdpa_consent_required') {
        setNeedsName(true);
        setError(t('errors.pdpa_consent_required'));
      } else {
        const key = `errors.${apiCode}`;
        setError(t.has(key as never) ? t(key as never) : t('errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-10 max-w-md mx-auto gap-8">
      <header className="flex flex-col gap-2">
        <span className="text-primary-700 font-extrabold text-2xl tracking-tight">MedQueue</span>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted">{t('subtitle')}</p>
      </header>

      <div className="flex gap-2" role="group" aria-label={t('language')}>
        {LOCALE_LABELS.map((option) => (
          <Button
            key={option.value}
            variant={option.value === locale ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => router.replace(pathname, { locale: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {step === 'phone' ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
        >
          <TextField
            label={t('phoneLabel')}
            placeholder="07X XXX XXXX"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error}
            hint={t('phoneHint')}
          />
          <Button type="submit" size="lg" loading={busy} disabled={phone.trim().length < 9}>
            {t('sendCode')}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <TextField
            label={t('codeLabel')}
            placeholder="••••••"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            error={error}
            hint={t('codeHint', { phone })}
            className="mq-tabular text-center text-xl"
          />
          {needsName && (
            <>
              <TextField
                label={t('nameLabel')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1"
                />
                <span>{t('pdpaConsent')}</span>
              </label>
            </>
          )}
          <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
            {t('verify')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep('phone')}>
            {t('changeNumber')}
          </Button>
        </form>
      )}
    </main>
  );
}
