import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { REDIS } from '../../infra/redis/redis.module';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120; // global default per IP per minute

/** Redis sliding-window (sorted set) rate limiter applied globally. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? 'unknown';
    const key = `rl:global:${ip}`;
    const now = Date.now();

    const [, , [, count]] = (await this.redis
      .multi()
      .zremrangebyscore(key, 0, now - WINDOW_MS)
      .zadd(key, now, `${now}:${Math.random()}`)
      .zcard(key)
      .expire(key, Math.ceil(WINDOW_MS / 1000))
      .exec()) as [unknown, unknown, [unknown, number], unknown];

    if (count > MAX_REQUESTS) {
      throw new HttpException('rate_limited', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
