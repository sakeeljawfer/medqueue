import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics. Uses a dedicated registry (not the global one) so
 * hot-reload in dev and unit tests never hit duplicate-metric errors.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration by route and status code',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly queueAdvances = new Counter({
    name: 'queue_advances_total',
    help: 'Times a doctor advanced a queue (next patient called)',
    registers: [this.registry],
  });

  readonly bookings = new Counter({
    name: 'queue_bookings_total',
    help: 'Tokens issued to patients',
    registers: [this.registry],
  });

  readonly liveSessions = new Gauge({
    name: 'sessions_live',
    help: 'Sessions currently LIVE or PAUSED',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  @OnEvent('queue.advanced')
  onQueueAdvanced(): void {
    this.queueAdvances.inc();
  }

  @OnEvent('queue.patient_booked')
  onPatientBooked(): void {
    this.bookings.inc();
  }

  @OnEvent('session.started')
  onSessionStarted(): void {
    this.liveSessions.inc();
  }

  @OnEvent('session.ended')
  onSessionEnded(): void {
    this.liveSessions.dec();
  }
}
