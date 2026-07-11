import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ENV, type Env } from '../../config/env';

export interface PayhereCheckout {
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: 'LKR';
  amount: string;
  hash: string;
  sandbox: boolean;
}

export interface PayhereWebhookBody {
  merchant_id: string;
  order_id: string;
  payment_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string; // 2 = success, 0 = pending, -1 = cancelled, -2 = failed, -3 = chargedback
  md5sig: string;
}

/**
 * PayHere integration (https://support.payhere.lk/api-&-mobile-sdk).
 * Checkout hash:  MD5(merchant_id + order_id + amount + currency + MD5(secret))
 * Webhook sig:    MD5(merchant_id + order_id + amount + currency + status_code + MD5(secret))
 * Both upper-cased hex.
 */
@Injectable()
export class PayhereService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private md5Upper(value: string): string {
    return createHash('md5').update(value).digest('hex').toUpperCase();
  }

  private secretHash(): string {
    return this.md5Upper(this.env.PAYHERE_MERCHANT_SECRET ?? '');
  }

  formatAmount(amountLKR: number): string {
    return amountLKR.toFixed(2);
  }

  buildCheckout(orderId: string, amountLKR: number, items: string): PayhereCheckout {
    const merchantId = this.env.PAYHERE_MERCHANT_ID ?? '';
    const amount = this.formatAmount(amountLKR);
    return {
      merchant_id: merchantId,
      return_url: `${this.env.WEB_URL}/doctor/payments/return`,
      cancel_url: `${this.env.WEB_URL}/doctor/payments/cancelled`,
      notify_url: `${this.env.API_URL}/payments/payhere/webhook`,
      order_id: orderId,
      items,
      currency: 'LKR',
      amount,
      hash: this.md5Upper(`${merchantId}${orderId}${amount}LKR${this.secretHash()}`),
      sandbox: this.env.PAYHERE_MODE === 'sandbox',
    };
  }

  verifyWebhookSignature(body: PayhereWebhookBody): boolean {
    const expected = this.md5Upper(
      `${body.merchant_id}${body.order_id}${body.payhere_amount}` +
        `${body.payhere_currency}${body.status_code}${this.secretHash()}`,
    );
    return expected === body.md5sig?.toUpperCase();
  }
}
