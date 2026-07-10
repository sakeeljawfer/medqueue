import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoSinhala = Noto_Sans_Sinhala({
  subsets: ['sinhala'],
  variable: '--font-sinhala',
  display: 'swap',
});
const notoTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  variable: '--font-tamil',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MedQueue LK',
  description: 'Live dispensary queues across Sri Lanka',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      data-locale={locale}
      className={`${inter.variable} ${notoSinhala.variable} ${notoTamil.variable}`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
