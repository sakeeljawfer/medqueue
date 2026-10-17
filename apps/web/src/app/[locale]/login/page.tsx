'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LoginView, type PortalType } from '@/components/login-view';
import { Skeleton } from '@medqueue/ui';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const portalParam = searchParams.get('portal');
  const initialPortal: PortalType =
    portalParam === 'doctor' || portalParam === 'admin' ? portalParam : 'patient';

  return <LoginView initialPortal={initialPortal} showPortalTabs={false} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh flex flex-col justify-center px-6 py-10 max-w-md mx-auto gap-6">
          <Skeleton height={40} />
          <Skeleton height={80} />
          <Skeleton height={200} />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
