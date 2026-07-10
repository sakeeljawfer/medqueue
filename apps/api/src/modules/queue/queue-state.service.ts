import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { QueueState, QueueYou } from '@medqueue/shared';
import type { AppointmentStatus, SessionStatus } from '@prisma/client';
import { REDIS } from '../../infra/redis/redis.module';

/**
 * Redis is the source of truth for LIVE queue state; Postgres is the durable
 * record, reconciled at session end.
 *
 * Keys per session:
 *   queue:wait:{id}   sorted set — waiting token numbers (score = token)
 *   queue:meta:{id}   hash — status, currentToken, servedCount, totalBooked,
 *                     consultTotalSecs, consultCount, fallbackAvgMins
 *   queue:owner:{id}  hash — tokenNumber -> patientId (for targeted pushes)
 */
@Injectable()
export class QueueStateService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private waitKey(id: string): string {
    return `queue:wait:${id}`;
  }
  private metaKey(id: string): string {
    return `queue:meta:${id}`;
  }
  private ownerKey(id: string): string {
    return `queue:owner:${id}`;
  }

  async initSession(sessionId: string, fallbackAvgMins: number): Promise<void> {
    await this.redis.hset(this.metaKey(sessionId), {
      status: 'LIVE',
      currentToken: 0,
      servedCount: 0,
      totalBooked: 0,
      consultTotalSecs: 0,
      consultCount: 0,
      fallbackAvgMins,
    });
  }

  async setStatus(sessionId: string, status: SessionStatus): Promise<void> {
    await this.redis.hset(this.metaKey(sessionId), 'status', status);
  }

  async addWaiting(sessionId: string, tokenNumber: number, patientId: string): Promise<void> {
    await this.redis
      .multi()
      .zadd(this.waitKey(sessionId), tokenNumber, String(tokenNumber))
      .hset(this.ownerKey(sessionId), String(tokenNumber), patientId)
      .hincrby(this.metaKey(sessionId), 'totalBooked', 1)
      .exec();
  }

  async removeWaiting(sessionId: string, tokenNumber: number): Promise<void> {
    await this.redis.zrem(this.waitKey(sessionId), String(tokenNumber));
  }

  /** Pop the lowest waiting token; returns null when the queue is empty. */
  async popNext(sessionId: string): Promise<number | null> {
    const popped = await this.redis.zpopmin(this.waitKey(sessionId));
    if (!popped || popped.length === 0) return null;
    const token = Number(popped[0]);
    await this.redis.hset(this.metaKey(sessionId), 'currentToken', token);
    return token;
  }

  async recordConsult(sessionId: string, durationSecs: number): Promise<void> {
    await this.redis
      .multi()
      .hincrby(this.metaKey(sessionId), 'consultTotalSecs', Math.round(durationSecs))
      .hincrby(this.metaKey(sessionId), 'consultCount', 1)
      .hincrby(this.metaKey(sessionId), 'servedCount', 1)
      .exec();
  }

  async incrementServed(sessionId: string): Promise<void> {
    await this.redis.hincrby(this.metaKey(sessionId), 'servedCount', 1);
  }

  async avgConsultMinutes(sessionId: string): Promise<number> {
    const meta = await this.redis.hgetall(this.metaKey(sessionId));
    return QueueStateService.computeAvgMinutes(
      Number(meta.consultTotalSecs ?? 0),
      Number(meta.consultCount ?? 0),
      Number(meta.fallbackAvgMins ?? 10),
    );
  }

  /** Rolling average of real consult durations; falls back to the schedule's estimate. */
  static computeAvgMinutes(
    consultTotalSecs: number,
    consultCount: number,
    fallbackAvgMins: number,
  ): number {
    if (consultCount === 0) return fallbackAvgMins;
    return Math.max(1, Math.round((consultTotalSecs / consultCount / 60) * 10) / 10);
  }

  static computeEta(position: number, avgMinutes: number): number {
    return Math.round(position * avgMinutes);
  }

  async getState(sessionId: string): Promise<QueueState> {
    const meta = await this.redis.hgetall(this.metaKey(sessionId));
    const avg = QueueStateService.computeAvgMinutes(
      Number(meta.consultTotalSecs ?? 0),
      Number(meta.consultCount ?? 0),
      Number(meta.fallbackAvgMins ?? 10),
    );
    return {
      sessionId,
      status: (meta.status ?? 'SCHEDULED') as QueueState['status'],
      currentToken: Number(meta.currentToken ?? 0),
      servedCount: Number(meta.servedCount ?? 0),
      totalBooked: Number(meta.totalBooked ?? 0),
      avgConsultMinutes: avg,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Position = waiting tokens strictly ahead of yours. 0 means you are next/current. */
  async positionOf(sessionId: string, tokenNumber: number): Promise<number> {
    return this.redis.zcount(this.waitKey(sessionId), '-inf', `(${tokenNumber}`);
  }

  async youFor(
    sessionId: string,
    tokenNumber: number,
    status: AppointmentStatus,
  ): Promise<QueueYou> {
    const [position, avg] = await Promise.all([
      this.positionOf(sessionId, tokenNumber),
      this.avgConsultMinutes(sessionId),
    ]);
    return {
      sessionId,
      yourToken: tokenNumber,
      position,
      etaMinutes: QueueStateService.computeEta(position, avg),
      status,
    };
  }

  /** patientIds of everyone still waiting — used to fan out queue.you updates. */
  async waitingOwners(sessionId: string): Promise<Array<{ token: number; patientId: string }>> {
    const tokens = await this.redis.zrange(this.waitKey(sessionId), 0, -1);
    if (tokens.length === 0) return [];
    const owners = await this.redis.hmget(this.ownerKey(sessionId), ...tokens);
    return tokens.flatMap((t, i) =>
      owners[i] ? [{ token: Number(t), patientId: owners[i]! }] : [],
    );
  }

  async waitingCount(sessionId: string): Promise<number> {
    return this.redis.zcard(this.waitKey(sessionId));
  }

  async clear(sessionId: string): Promise<void> {
    await this.redis.del(this.waitKey(sessionId), this.metaKey(sessionId), this.ownerKey(sessionId));
  }
}
