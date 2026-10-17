'use client';

import { LoginView } from '@/components/login-view';

export default function DoctorLoginPage() {
  return <LoginView initialPortal="doctor" showPortalTabs={false} />;
}

