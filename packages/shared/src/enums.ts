export const LOCALES = ['en', 'si', 'ta'] as const;
export type Locale = (typeof LOCALES)[number];

export const USER_ROLES = ['PATIENT', 'DOCTOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const SESSION_STATUSES = ['SCHEDULED', 'LIVE', 'PAUSED', 'ENDED', 'CANCELLED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const APPOINTMENT_STATUSES = [
  'BOOKED',
  'IN_CONSULT',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['PAYHERE', 'BANK_SLIP'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_TYPES = ['SUBSCRIPTION', 'LISTING'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const SPECIALTIES = [
  'GENERAL_PRACTICE',
  'PEDIATRICS',
  'GYNECOLOGY',
  'CARDIOLOGY',
  'DERMATOLOGY',
  'ENT',
  'OPHTHALMOLOGY',
  'ORTHOPEDICS',
  'PSYCHIATRY',
  'NEUROLOGY',
  'UROLOGY',
  'ONCOLOGY',
  'ENDOCRINOLOGY',
  'GASTROENTEROLOGY',
  'RESPIRATORY',
] as const;
export type Specialty = (typeof SPECIALTIES)[number];
