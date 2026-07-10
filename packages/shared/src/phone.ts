import { z } from 'zod';

/**
 * Sri Lankan mobile numbers. Accepted input forms:
 *   07X XXXXXXX, +947XXXXXXXX, 947XXXXXXXX
 * Canonical storage form: +947XXXXXXXX (E.164).
 */
const LK_MOBILE_RE = /^(?:\+94|94|0)7\d{8}$/;

export function normalizeLkPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (!LK_MOBILE_RE.test(cleaned)) return null;
  const digits = cleaned.replace(/^\+94|^94|^0/, '');
  return `+94${digits}`;
}

export const lkPhoneSchema = z
  .string()
  .transform((v, ctx) => {
    const normalized = normalizeLkPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_lk_mobile' });
      return z.NEVER;
    }
    return normalized;
  });

/** Render +94771234567 as "+94 77 123 4567" for display. */
export function formatLkPhone(e164: string): string {
  const m = /^\+94(7\d)(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+94 ${m[1]} ${m[2]} ${m[3]}`;
}
