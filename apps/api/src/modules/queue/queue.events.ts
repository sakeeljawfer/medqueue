import type { QueueState, QueueYou } from '@medqueue/shared';

/** Domain events emitted through NestJS EventEmitter2. */
export const QueueEvents = {
  SessionStarted: 'session.started',
  SessionPaused: 'session.paused',
  SessionResumed: 'session.resumed',
  SessionEnded: 'session.ended',
  QueueAdvanced: 'queue.advanced',
  PatientBooked: 'queue.patient_booked',
} as const;

export interface QueueStateChangedPayload {
  state: QueueState;
  /** Personal updates to deliver to specific patients. */
  you: Array<{ patientId: string; you: QueueYou }>;
}
