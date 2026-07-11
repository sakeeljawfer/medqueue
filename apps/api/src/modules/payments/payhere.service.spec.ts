import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { PayhereService } from './payhere.service';
import type { Env } from '../../config/env';

const env = {
  PAYHERE_MERCHANT_ID: '1211149',
  PAYHERE_MERCHANT_SECRET: 'test_secret',
  PAYHERE_MODE: 'sandbox',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000',
} as Env;

function md5Upper(v: string): string {
  return createHash('md5').update(v).digest('hex').toUpperCase();
}

describe('PayhereService', () => {
  const service = new PayhereService(env);

  it('builds a checkout with the documented hash formula', () => {
    const checkout = service.buildCheckout('order_1', 2500, 'MedQueue subscription');
    const secretHash = md5Upper('test_secret');
    expect(checkout.amount).toBe('2500.00');
    expect(checkout.hash).toBe(md5Upper(`1211149order_12500.00LKR${secretHash}`));
    expect(checkout.sandbox).toBe(true);
  });

  it('accepts a webhook with a valid signature', () => {
    const secretHash = md5Upper('test_secret');
    const body = {
      merchant_id: '1211149',
      order_id: 'order_1',
      payment_id: 'ph_123',
      payhere_amount: '2500.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: md5Upper(`1211149order_12500.00LKR2${secretHash}`),
    };
    expect(service.verifyWebhookSignature(body)).toBe(true);
  });

  it('rejects a webhook with a tampered amount', () => {
    const secretHash = md5Upper('test_secret');
    const body = {
      merchant_id: '1211149',
      order_id: 'order_1',
      payment_id: 'ph_123',
      payhere_amount: '1.00', // tampered
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: md5Upper(`1211149order_12500.00LKR2${secretHash}`),
    };
    expect(service.verifyWebhookSignature(body)).toBe(false);
  });

  it('rejects a webhook with a missing signature', () => {
    expect(
      service.verifyWebhookSignature({
        merchant_id: '1211149',
        order_id: 'order_1',
        payment_id: 'ph_123',
        payhere_amount: '2500.00',
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig: undefined as unknown as string,
      }),
    ).toBe(false);
  });
});
