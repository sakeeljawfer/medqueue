'use client';

import { LoginView } from '@/components/login-view';

export default function PatientLoginPage() {
  return <LoginView initialPortal="patient" showPortalTabs={false} />;
}

