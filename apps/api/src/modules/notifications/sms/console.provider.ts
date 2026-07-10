import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider } from './sms.provider';

/** Development provider: prints the SMS to the API log instead of sending. */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger('SMS');

  async send(phoneE164: string, message: string): Promise<void> {
    this.logger.log(`→ ${phoneE164}: ${message}`);
  }
}
