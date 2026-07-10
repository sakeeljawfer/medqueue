import { Injectable, Logger } from '@nestjs/common';
import type { Env } from '../../../config/env';
import type { SmsProvider } from './sms.provider';

/** https://www.notify.lk/ HTTP API. Expects local format 947XXXXXXXX. */
@Injectable()
export class NotifyLkProvider implements SmsProvider {
  readonly name = 'notifylk';
  private readonly logger = new Logger(NotifyLkProvider.name);

  constructor(private readonly env: Env) {}

  async send(phoneE164: string, message: string): Promise<void> {
    const to = phoneE164.replace(/^\+/, '');
    const params = new URLSearchParams({
      user_id: this.env.NOTIFYLK_USER_ID ?? '',
      api_key: this.env.NOTIFYLK_API_KEY ?? '',
      sender_id: this.env.NOTIFYLK_SENDER_ID,
      to,
      message,
    });

    const res = await fetch(`https://app.notify.lk/api/v1/send?${params.toString()}`);
    if (!res.ok) {
      this.logger.error({ status: res.status }, 'notify.lk send failed');
      throw new Error(`notifylk_send_failed_${res.status}`);
    }
    const body = (await res.json()) as { status?: string };
    if (body.status !== 'success') {
      throw new Error('notifylk_send_rejected');
    }
  }
}
