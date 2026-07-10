export interface SmsProvider {
  /** Send a message to an E.164 +94 number. Throws on provider failure. */
  send(phoneE164: string, message: string): Promise<void>;
  readonly name: string;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
