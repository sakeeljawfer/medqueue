import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { HealthModule } from './modules/health/health.module';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport:
          process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
