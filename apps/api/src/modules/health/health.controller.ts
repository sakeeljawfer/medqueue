import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('healthz')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  async readiness(): Promise<{ status: 'ok'; postgres: 'up'; redis: 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException('dependency_unavailable');
    }
    return { status: 'ok', postgres: 'up', redis: 'up' };
  }
}
