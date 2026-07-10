import { defineRouting } from 'next-intl/routing';
import { LOCALES } from '@medqueue/shared';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
});
