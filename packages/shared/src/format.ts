/** Format an amount in LKR as "Rs. 1,500.00". */
export function formatLKR(amount: number): string {
  const formatted = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs. ${formatted}`;
}

export const COLOMBO_TZ = 'Asia/Colombo';

/** Format a UTC instant in Colombo local time. */
export function formatColombo(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  locale = 'en-LK',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: COLOMBO_TZ }).format(d);
}
