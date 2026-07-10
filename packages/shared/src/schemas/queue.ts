import { z } from 'zod';

/** Broadcast to everyone in a session room. */
export const queueStateSchema = z.object({
  sessionId: z.string(),
  status: z.enum(['SCHEDULED', 'LIVE', 'PAUSED', 'ENDED', 'CANCELLED']),
  currentToken: z.number().int().nonnegative(),
  servedCount: z.number().int().nonnegative(),
  totalBooked: z.number().int().nonnegative(),
  avgConsultMinutes: z.number().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type QueueState = z.infer<typeof queueStateSchema>;

/** Sent only to the authenticated patient's socket. */
export const queueYouSchema = z.object({
  sessionId: z.string(),
  yourToken: z.number().int().positive(),
  position: z.number().int().nonnegative(),
  etaMinutes: z.number().nonnegative(),
  status: z.enum(['BOOKED', 'IN_CONSULT', 'COMPLETED', 'NO_SHOW', 'CANCELLED']),
});
export type QueueYou = z.infer<typeof queueYouSchema>;

export const QUEUE_EVENTS = {
  state: 'queue.state',
  you: 'queue.you',
} as const;
