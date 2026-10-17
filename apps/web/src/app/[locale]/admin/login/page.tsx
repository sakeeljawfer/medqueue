'use client';

import { LoginView } from '@/components/login-view';

export default function AdminLoginPage() {
  return <LoginView initialPortal="admin" showPortalTabs={false} />;
}

