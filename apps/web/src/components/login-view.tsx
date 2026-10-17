'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, TextField, Badge, useToast } from '@medqueue/ui';
import { useRouter, usePathname, Link } from '@/i18n/navigation';
import { api, ApiError, saveAuthSession } from '@/lib/api';
import { DISTRICTS, type Locale } from '@medqueue/shared';

export type PortalType = 'patient' | 'doctor' | 'admin';
export type AuthMode = 'signin' | 'register' | 'otp';

interface PortalConfig {
  titleKey: string;
  subtitleKey: string;
  badge: string;
  badgeTone: 'verified' | 'live' | 'neutral';
  icon: string;
  demoIdentifier: string;
  demoPassword: string;
  demoLabel: string;
  targetUrl: string;
  expectedRole?: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}

const PORTALS: Record<PortalType, PortalConfig> = {
  patient: {
    titleKey: 'patientPortal',
    subtitleKey: 'patientSubtitle',
    badge: 'Patient',
    badgeTone: 'verified',
    icon: '🩺',
    demoIdentifier: '077 123 4567',
    demoPassword: '901234567V',
    demoLabel: 'Patient',
    targetUrl: '/',
    expectedRole: 'PATIENT',
  },
  doctor: {
    titleKey: 'doctorConsole',
    subtitleKey: 'doctorSubtitle',
    badge: 'Doctor',
    badgeTone: 'live',
    icon: '👨‍⚕️',
    demoIdentifier: '077 700 0001',
    demoPassword: '751234567V',
    demoLabel: 'Doctor',
    targetUrl: '/doctor',
    expectedRole: 'DOCTOR',
  },
  admin: {
    titleKey: 'adminPortal',
    subtitleKey: 'adminSubtitle',
    badge: 'Admin',
    badgeTone: 'neutral',
    icon: '🛡️',
    demoIdentifier: '0718797487',
    demoPassword: '963501978V',
    demoLabel: 'Admin (0718797487 / 963501978V)',
    targetUrl: '/admin',
    expectedRole: 'ADMIN',
  },
};

const DOCTOR_SPECIALTIES = [
  { value: 'GENERAL_PRACTICE', label: 'General Practice / Family Physician' },
  { value: 'PEDIATRICS', label: 'Pediatrics (Children)' },
  { value: 'GYNECOLOGY', label: 'Gynecology & Obstetrics' },
  { value: 'CARDIOLOGY', label: 'Cardiology (Heart)' },
  { value: 'DERMATOLOGY', label: 'Dermatology (Skin)' },
  { value: 'ENT', label: 'ENT (Ear, Nose, Throat)' },
  { value: 'OPHTHALMOLOGY', label: 'Ophthalmology (Eye)' },
  { value: 'ORTHOPEDICS', label: 'Orthopedics (Bones & Joints)' },
  { value: 'PSYCHIATRY', label: 'Psychiatry & Mental Health' },
  { value: 'NEUROLOGY', label: 'Neurology' },
  { value: 'UROLOGY', label: 'Urology' },
  { value: 'ONCOLOGY', label: 'Oncology' },
  { value: 'ENDOCRINOLOGY', label: 'Endocrinology & Diabetes' },
  { value: 'GASTROENTEROLOGY', label: 'Gastroenterology' },
  { value: 'RESPIRATORY', label: 'Respiratory Medicine' },
];

const LOCALE_LABELS: Array<{ value: Locale; label: string }> = [
  { value: 'si', label: 'සිංහල' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'en', label: 'English' },
];

export function LoginView({
  initialPortal = 'patient',
  showPortalTabs = false,
}: {
  initialPortal?: PortalType;
  showPortalTabs?: boolean;
}) {
  const t = useTranslations('login');
  const tPortals = useTranslations('portals');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const [portal, setPortal] = useState<PortalType>(initialPortal);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Sign in state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Patient Register state
  const [name, setName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [nic, setNic] = useState('');

  // Doctor Register state
  const [slmcRegNo, setSlmcRegNo] = useState('');
  const [specialty, setSpecialty] = useState('GENERAL_PRACTICE');
  const [consultationFee, setConsultationFee] = useState('1500');
  const [dispensaryName, setDispensaryName] = useState('');
  const [town, setTown] = useState('');
  const [district, setDistrict] = useState('colombo');

  // OTP state
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const currentPortal = PORTALS[portal];

  function handlePortalChange(newPortal: PortalType) {
    setPortal(newPortal);
    setError(undefined);
    setMode('signin');
    setIdentifier('');
    setPassword('');
  }

  function quickFillDemo() {
    setIdentifier(currentPortal.demoIdentifier);
    setPassword(currentPortal.demoPassword);
    setError(undefined);
  }

  // --- Sign In with Phone / Username + NIC / Password ---
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);

    try {
      const result = await api<{ id: string; role: string; name: string | null; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password: password.trim() }),
      });

      if (result.accessToken) {
        saveAuthSession(result.role, result.accessToken);
      }

      toast({ title: t('welcome'), tone: 'success' });
      if (result.role === 'ADMIN') {
        router.replace('/admin');
      } else if (result.role === 'DOCTOR') {
        router.replace('/doctor');
      } else {
        router.replace('/');
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_credentials') {
        setError('Invalid Phone Number or NIC / Password.');
      } else if (e instanceof ApiError && e.code === 'account_disabled') {
        setError(t('errors.account_disabled'));
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  }

  // --- Patient Registration ---
  async function handlePatientRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);

    try {
      const result = await api<{ id: string; role: string; name: string | null; accessToken: string }>('/auth/register/patient', {
        method: 'POST',
        body: JSON.stringify({
          phone: regPhone.trim(),
          nic: nic.trim(),
          name: name.trim(),
          preferredLanguage: locale,
        }),
      });

      if (result.accessToken) {
        saveAuthSession(result.role, result.accessToken);
      }

      toast({ title: 'Account created successfully!', tone: 'success' });
      router.replace('/');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'phone_already_registered') {
        setError('This phone number is already registered. Please sign in.');
      } else if (e instanceof ApiError && e.code === 'nic_already_registered') {
        setError('This NIC is already registered. Please sign in.');
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  }

  // --- Doctor Registration ---
  async function handleDoctorRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);

    try {
      const result = await api<{ id: string; role: string; name: string | null; accessToken: string }>('/auth/register/doctor', {
        method: 'POST',
        body: JSON.stringify({
          phone: regPhone.trim(),
          nic: nic.trim(),
          name: name.trim(),
          slmcRegNo: slmcRegNo.trim(),
          specialty,
          consultationFeeLKR: Number(consultationFee) || 1500,
          dispensaryName: dispensaryName.trim() || `${town.trim()} Medical Centre`,
          town: town.trim(),
          district,
        }),
      });

      if (result.accessToken) {
        saveAuthSession(result.role, result.accessToken);
      }

      toast({ title: 'Doctor profile registered and approved!', tone: 'success' });
      router.replace('/doctor');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'phone_already_registered') {
        setError('This phone number is already registered. Please sign in.');
      } else if (e instanceof ApiError && e.code === 'slmc_already_registered') {
        setError('This SLMC Registration Number is already registered.');
      } else if (e instanceof ApiError && e.code === 'nic_already_registered') {
        setError('This NIC is already registered.');
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  }

  // --- OTP Flow (Fallback) ---
  async function requestOtpCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ sent: boolean; code?: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: otpPhone }),
      });
      if (res?.code) setOtpCode(res.code);
      setOtpStep('code');
    } catch (e) {
      const apiCode = e instanceof ApiError ? e.code : 'generic';
      setError(t.has(`errors.${apiCode}` as never) ? t(`errors.${apiCode}` as never) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtpCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const result = await api<{ id: string; role: string; name: string | null; accessToken: string }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({
          phone: otpPhone,
          code: otpCode,
          preferredLanguage: locale,
          pdpaConsent: true,
        }),
      });
      if (result.accessToken) {
        saveAuthSession(result.role, result.accessToken);
      }
      toast({ title: t('welcome'), tone: 'success' });
      if (result.role === 'ADMIN') router.replace('/admin');
      else if (result.role === 'DOCTOR') router.replace('/doctor');
      else router.replace('/');
    } catch (e) {
      const apiCode = e instanceof ApiError ? e.code : 'generic';
      setError(t.has(`errors.${apiCode}` as never) ? t(`errors.${apiCode}` as never) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-10 max-w-md mx-auto gap-6">
      {/* Optional Portal Switcher Tabs */}
      {showPortalTabs && (
        <div className="flex p-1 bg-surface-sunken rounded-card gap-1 border border-line">
          {(['patient', 'doctor', 'admin'] as const).map((p) => {
            const active = portal === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePortalChange(p)}
                className={`flex-1 py-2 px-2 text-xs font-semibold rounded-card transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  active
                    ? 'bg-white text-primary-700 shadow-xs border border-line/60'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <span>{PORTALS[p].icon}</span>
                <span>{tPortals(p)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-primary-700 font-extrabold text-2xl tracking-tight">
            MedQueue
          </Link>
          <Badge tone={currentPortal.badgeTone}>
            {currentPortal.icon} {tPortals(currentPortal.titleKey as never)}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === 'register'
            ? portal === 'doctor'
              ? 'Doctor Practice Registration'
              : 'Patient Registration'
            : tPortals(currentPortal.titleKey as never)}
        </h1>
        <p className="text-sm text-muted">
          {mode === 'register'
            ? portal === 'doctor'
              ? 'Register with your Phone, NIC, and SLMC number to start managing dispensary queues.'
              : 'Register with your Mobile Number and NIC (used as your password).'
            : tPortals(currentPortal.subtitleKey as never)}
        </p>
      </header>

      {/* Language Switcher */}
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

      {/* Quick Fill Demo Chip for Login */}
      {mode === 'signin' && (
        <div className="flex items-center justify-between text-xs bg-surface-raised p-2.5 rounded-card border border-line">
          <span className="text-muted truncate mr-2">
            {tPortals('quickFill')} <strong className="text-ink">{currentPortal.demoLabel}</strong>
          </span>
          <button
            type="button"
            onClick={quickFillDemo}
            className="text-primary-700 font-bold hover:underline cursor-pointer shrink-0"
          >
            Fill Demo
          </button>
        </div>
      )}

      {/* Mode 1: Sign in with Phone/Username + NIC/Password */}
      {mode === 'signin' && (
        <form className="flex flex-col gap-4" onSubmit={handlePasswordLogin}>
          <TextField
            label={portal === 'admin' ? 'Username or Mobile Number' : 'Mobile Number'}
            placeholder={portal === 'admin' ? '0718797487' : '07X XXX XXXX'}
            inputMode={portal === 'admin' ? 'text' : 'tel'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            error={error}
          />
          <TextField
            label={portal === 'admin' ? 'Password' : 'NIC Number (Password)'}
            placeholder={portal === 'admin' ? '963501978V' : 'e.g. 963501978V'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={
              portal === 'admin'
                ? 'Default admin password: pass 963501978V'
                : 'Your Sri Lankan National Identity Card (NIC) number.'
            }
          />

          <Button type="submit" size="lg" loading={busy} disabled={!identifier.trim() || !password.trim()}>
            Sign In
          </Button>

          <div className="flex flex-col gap-2 pt-2 text-center text-xs">
            {portal === 'patient' && (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(undefined);
                }}
                className="text-primary-700 hover:underline font-semibold"
              >
                New patient? Create an account with your NIC →
              </button>
            )}

            {portal === 'doctor' && (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(undefined);
                }}
                className="text-primary-700 hover:underline font-semibold"
              >
                New doctor? Register your dispensary practice →
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMode('otp');
                setOtpPhone(identifier);
                setError(undefined);
              }}
              className="text-muted hover:text-ink hover:underline"
            >
              Or sign in with SMS OTP
            </button>
          </div>
        </form>
      )}

      {/* Mode 2: Patient Registration */}
      {mode === 'register' && portal === 'patient' && (
        <form className="flex flex-col gap-4" onSubmit={handlePatientRegister}>
          <TextField
            label="Full Name"
            placeholder="e.g. Saman Kumara"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            label="Mobile Number"
            placeholder="07X XXX XXXX"
            inputMode="tel"
            value={regPhone}
            onChange={(e) => setRegPhone(e.target.value)}
            hint="Used to receive queue notifications."
            required
          />
          <TextField
            label="National Identity Card (NIC) — Password"
            placeholder="e.g. 963501978V or 200012345678"
            value={nic}
            onChange={(e) => setNic(e.target.value)}
            hint="Your NIC acts as your password for fast, secure logins."
            error={error}
            required
          />

          <p className="text-xs text-muted leading-relaxed">
            By registering, you agree to MedQueue storing your details to manage appointments and queue tokens in accordance with Sri Lanka PDPA No. 9 of 2022.
          </p>

          <Button type="submit" size="lg" loading={busy} disabled={!name.trim() || !regPhone.trim() || !nic.trim()}>
            Register & Continue
          </Button>

          <div className="pt-2 text-center text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(undefined);
              }}
              className="text-primary-700 hover:underline font-semibold"
            >
              ← Already registered? Sign in with NIC
            </button>
          </div>
        </form>
      )}

      {/* Mode 2: Doctor Practice Registration */}
      {mode === 'register' && portal === 'doctor' && (
        <form className="flex flex-col gap-4" onSubmit={handleDoctorRegister}>
          <TextField
            label="Doctor's Full Name"
            placeholder="e.g. Dr. Nimal Perera"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            label="Mobile Number"
            placeholder="07X XXX XXXX"
            inputMode="tel"
            value={regPhone}
            onChange={(e) => setRegPhone(e.target.value)}
            required
          />
          <TextField
            label="National Identity Card (NIC) — Password"
            placeholder="e.g. 751234567V or 197512345678"
            value={nic}
            onChange={(e) => setNic(e.target.value)}
            hint="Your NIC acts as your password to access the Doctor Console."
            required
          />
          <TextField
            label="SLMC Registration Number"
            placeholder="e.g. SLMC-45678"
            value={slmcRegNo}
            onChange={(e) => setSlmcRegNo(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5 text-sm">
            <label className="font-semibold text-ink">Specialty</label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="h-10 px-3 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
            >
              {DOCTOR_SPECIALTIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <TextField
            label="Consultation Fee (LKR)"
            placeholder="1500"
            inputMode="numeric"
            value={consultationFee}
            onChange={(e) => setConsultationFee(e.target.value)}
          />

          <div className="border-t border-line pt-3 flex flex-col gap-3">
            <h3 className="font-bold text-sm text-ink">Primary Dispensary</h3>
            <TextField
              label="Dispensary Name"
              placeholder="e.g. Colombo Medical Centre"
              value={dispensaryName}
              onChange={(e) => setDispensaryName(e.target.value)}
              required
            />
            <TextField
              label="Town / Area"
              placeholder="e.g. Nugegoda"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5 text-sm">
              <label className="font-semibold text-ink">District</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="h-10 px-3 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                {DISTRICTS.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-danger font-medium">{error}</p>}

          <Button
            type="submit"
            size="lg"
            loading={busy}
            disabled={!name.trim() || !regPhone.trim() || !nic.trim() || !slmcRegNo.trim() || !town.trim()}
          >
            Complete Registration & Start
          </Button>

          <div className="pt-2 text-center text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(undefined);
              }}
              className="text-primary-700 hover:underline font-semibold"
            >
              ← Already registered? Sign in with NIC
            </button>
          </div>
        </form>
      )}

      {/* Mode 3: SMS OTP Login */}
      {mode === 'otp' && (
        <div>
          {otpStep === 'phone' ? (
            <form className="flex flex-col gap-4" onSubmit={requestOtpCode}>
              <TextField
                label={t('phoneLabel')}
                placeholder="07X XXX XXXX"
                inputMode="tel"
                value={otpPhone}
                onChange={(e) => setOtpPhone(e.target.value)}
                error={error}
                hint="We'll send a 6-digit verification code."
              />
              <Button type="submit" size="lg" loading={busy} disabled={otpPhone.trim().length < 9}>
                {t('sendCode')}
              </Button>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={verifyOtpCode}>
              <TextField
                label={t('codeLabel')}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                error={error}
                hint={t('codeHint', { phone: otpPhone })}
                className="mq-tabular text-center text-xl"
              />
              <Button type="submit" size="lg" loading={busy} disabled={otpCode.length !== 6}>
                {t('verify')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOtpStep('phone')}>
                {t('changeNumber')}
              </Button>
            </form>
          )}

          <div className="pt-4 text-center text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(undefined);
              }}
              className="text-primary-700 hover:underline font-semibold"
            >
              ← Sign in with Phone & NIC instead
            </button>
          </div>
        </div>
      )}

      {/* Footer navigation */}
      <footer className="flex justify-center pt-2 text-xs text-muted">
        {portal === 'patient' ? (
          <div className="flex items-center gap-2">
            <span>Doctor or staff?</span>
            <Link href="/doctor/login" className="text-primary-700 hover:underline font-semibold">
              Doctor Console
            </Link>
            <span>·</span>
            <Link href="/admin/login" className="text-primary-700 hover:underline font-semibold">
              Admin Portal
            </Link>
          </div>
        ) : (
          <Link href="/" className="hover:text-primary-700 hover:underline">
            ← Return to Patient Portal
          </Link>
        )}
      </footer>
    </main>
  );
}
