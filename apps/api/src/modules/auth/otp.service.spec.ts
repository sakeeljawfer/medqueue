import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, HttpException } from '@nestjs/common';
import { OtpService } from './otp.service';
import type { Env } from '../../config/env';
import type { Redis } from 'ioredis';
import type { SmsProvider } from '../notifications/sms/sms.provider';

const env = { JWT_ACCESS_SECRET: 'a'.repeat(32) } as Env;

/** Minimal in-memory Redis supporting the commands OtpService uses. */
function makeFakeRedis() {
  const store = new Map<string, string>();
  const fake = {
    store,
    incr: vi.fn(async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async () => 1),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    }),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    multi() {
      const ops: Array<() => Promise<unknown>> = [];
      const chain = {
        set: (key: string, value: string) => {
          ops.push(async () => store.set(key, value));
          return chain;
        },
        exec: async () => {
          for (const op of ops) await op();
          return [];
        },
      };
      return chain;
    },
  };
  return fake;
}

describe('OtpService', () => {
  let redis: ReturnType<typeof makeFakeRedis>;
  let sms: SmsProvider & { send: ReturnType<typeof vi.fn> };
  let service: OtpService;

  beforeEach(() => {
    redis = makeFakeRedis();
    sms = { name: 'test', send: vi.fn(async () => undefined) };
    service = new OtpService(redis as unknown as Redis, env, sms);
  });

  async function requestAndCapture(phone: string): Promise<string> {
    await service.request(phone, '10.0.0.1');
    const message = sms.send.mock.calls.at(-1)?.[1] as string;
    const code = /(\d{6})/.exec(message)?.[1];
    expect(code).toBeTruthy();
    return code!;
  }

  it('sends a 6-digit code and verifies it once', async () => {
    const code = await requestAndCapture('+94771234567');
    await expect(service.verify('+94771234567', code)).resolves.toBeUndefined();
    // Consumed: second verify fails.
    await expect(service.verify('+94771234567', code)).rejects.toThrow(BadRequestException);
  });

  it('rejects a wrong code and locks after 3 attempts', async () => {
    const code = await requestAndCapture('+94771234567');
    const wrong = code === '000000' ? '111111' : '000000';
    await expect(service.verify('+94771234567', wrong)).rejects.toThrow('otp_invalid');
    await expect(service.verify('+94771234567', wrong)).rejects.toThrow('otp_invalid');
    await expect(service.verify('+94771234567', wrong)).rejects.toThrow('otp_invalid');
    // Fourth attempt: code has been destroyed even if now correct.
    await expect(service.verify('+94771234567', code)).rejects.toThrow(
      'otp_too_many_attempts',
    );
  });

  it('rate limits: 4th request for same phone within window is rejected', async () => {
    await service.request('+94771234567', '10.0.0.1');
    await service.request('+94771234567', '10.0.0.2');
    await service.request('+94771234567', '10.0.0.3');
    await expect(service.request('+94771234567', '10.0.0.4')).rejects.toThrow(HttpException);
  });

  it('rate limits by IP: 11th request from same IP is rejected', async () => {
    for (let i = 0; i < 10; i++) {
      await service.request(`+947712345${String(i).padStart(2, '0')}`, '10.0.0.9');
    }
    await expect(service.request('+94771234599', '10.0.0.9')).rejects.toThrow(HttpException);
  });
});
