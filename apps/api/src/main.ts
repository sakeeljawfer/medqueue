import './infra/telemetry/tracing'; // must be first: patches node:http for OTel
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  if (env.SENTRY_DSN_API) {
    Sentry.init({
      dsn: env.SENTRY_DSN_API,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(cookieParser());
  const allowedOrigins = [
    env.WEB_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  app.enableCors({
    origin:
      env.NODE_ENV === 'production'
        ? allowedOrigins
        : (
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void,
          ) => {
            // In development, allow localhost, 127.0.0.1, local LAN IPs, or matching WEB_URL
            if (
              !origin ||
              allowedOrigins.includes(origin) ||
              /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)
            ) {
              return callback(null, true);
            }
            callback(new Error('Not allowed by CORS'));
          },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
}

void bootstrap();
