import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { HealthModule } from './modules/health/health.module';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { SmsModule } from './modules/notifications/sms/sms.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

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
    SmsModule,
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
