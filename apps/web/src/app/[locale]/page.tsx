import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('home');

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-heading-1">{t('title')}</h1>
      <p className="text-body text-muted">{t('tagline')}</p>
    </main>
  );
}
