import { z } from 'zod';
import { lkPhoneSchema } from '../phone.js';
import { LOCALES } from '../enums.js';

export const requestOtpSchema = z.object({
  phone: lkPhoneSchema,
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: lkPhoneSchema,
  code: z.string().regex(/^\d{6}$/, 'otp_must_be_6_digits'),
  name: z.string().min(1).max(120).optional(),
  preferredLanguage: z.enum(LOCALES).optional(),
  pdpaConsent: z.boolean().optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
