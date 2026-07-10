import { Injectable, Logger } from '@nestjs/common';
import type { Env } from '../../../config/env';
import type { SmsProvider } from './sms.provider';

/**
 * Dialog Ideabiz SMS API. OAuth2 client-credentials token, cached until expiry,
 * then POST to the SMS send endpoint.
 */
@Injectable()
export class IdeabizProvider implements SmsProvider {
  readonly name = 'ideabiz';
  private readonly logger = new Logger(IdeabizProvider.name);
  private token: { value: string; expiresAt: number } | null = null;

  private static readonly BASE = 'https://api.ideabiz.lk';

  constructor(private readonly env: Env) {}

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.value;
    }
    const credentials = Buffer.from(
      `${this.env.IDEABIZ_CLIENT_ID}:${this.env.IDEABIZ_CLIENT_SECRET}`,
    ).toString('base64');
    const res = await fetch(`${IdeabizProvider.BASE}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`ideabiz_token_failed_${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return this.token.value;
  }

  async send(phoneE164: string, message: string): Promise<void> {
    const token = await this.getToken();
    const to = `tel:${phoneE164}`;
    const res = await fetch(
      `${IdeabizProvider.BASE}/smsmessaging/v3/outbound/MedQueue/requests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: [to],
            outboundSMSTextMessage: { message },
            senderName: 'MedQueue',
          },
        }),
      },
    );
    if (!res.ok) {
      this.logger.error({ status: res.status }, 'ideabiz send failed');
      throw new Error(`ideabiz_send_failed_${res.status}`);
    }
  }
}
