import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function PayhereCancelled() {
  const t = useTranslations('payments.cancelled');
  return (
    <main className="min-h-dvh max-w-md mx-auto px-6 py-16 flex flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-sm text-muted">{t('body')}</p>
      <Link href="/doctor/payments" className="mq-btn mq-btn--secondary mq-btn--md mt-2">
        {t('cta')}
      </Link>
    </main>
  );
}
