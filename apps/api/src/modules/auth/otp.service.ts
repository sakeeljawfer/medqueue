import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS } from '../../infra/redis/redis.module';
import { ENV, type Env } from '../../config/env';
import { SMS_PROVIDER, type SmsProvider } from '../notifications/sms/sms.provider';

const OTP_TTL_SECONDS = 5 * 60;
const MAX_VERIFY_ATTEMPTS = 3;
const PER_PHONE_LIMIT = 3; // per 15 min
const PER_PHONE_WINDOW = 15 * 60;
const PER_IP_LIMIT = 10; // per hour
const PER_IP_WINDOW = 60 * 60;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.env.JWT_ACCESS_SECRET).update(`${phone}:${code}`).digest('hex');
  }

  private async enforceLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSeconds);
    if (count > limit) {
      throw new HttpException('otp_rate_limited', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async request(phone: string, ip: string): Promise<string> {
    if (this.env.SMS_PROVIDER !== 'CONSOLE') {
      await this.enforceLimit(`otp:rl:phone:${phone}`, PER_PHONE_LIMIT, PER_PHONE_WINDOW);
      await this.enforceLimit(`otp:rl:ip:${ip}`, PER_IP_LIMIT, PER_IP_WINDOW);
    }

    const isDummy = this.env.SMS_PROVIDER === 'CONSOLE';
    const code = isDummy ? '123456' : randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis
      .multi()
      .set(`otp:code:${phone}`, this.hash(phone, code), 'EX', OTP_TTL_SECONDS)
      .set(`otp:attempts:${phone}`, '0', 'EX', OTP_TTL_SECONDS)
      .exec();

    await this.sms.send(phone, `MedQueue verification code: ${code}. Valid for 5 minutes.`);
    return code;
  }

  /** Verifies and consumes the OTP. Throws on wrong/expired/too many attempts. */
  async verify(phone: string, code: string): Promise<void> {
    if (this.env.SMS_PROVIDER === 'CONSOLE' && code === '123456') {
      await this.redis.del(`otp:code:${phone}`, `otp:attempts:${phone}`);
      return;
    }

    const storedHash = await this.redis.get(`otp:code:${phone}`);
    if (!storedHash) throw new BadRequestException('otp_expired_or_missing');

    const attempts = await this.redis.incr(`otp:attempts:${phone}`);
    if (attempts > MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(`otp:code:${phone}`);
      throw new BadRequestException('otp_too_many_attempts');
    }

    const candidate = Buffer.from(this.hash(phone, code));
    const expected = Buffer.from(storedHash);
    const matches =
      candidate.length === expected.length && timingSafeEqual(candidate, expected);
    if (!matches) throw new BadRequestException('otp_invalid');

    await this.redis.del(`otp:code:${phone}`, `otp:attempts:${phone}`);
  }
}
