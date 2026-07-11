'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, Skeleton, useToast } from '@medqueue/ui';
import { Link } from '@/i18n/navigation';
import { api, API_URL, ApiError } from '@/lib/api';

type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface PaymentRow {
  id: string;
  type: 'SUBSCRIPTION' | 'LISTING';
  amountLKR: string;
  method: 'PAYHERE' | 'BANK_SLIP';
  status: PaymentStatus;
  createdAt: string;
}

interface PayhereCheckout {
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: string;
  amount: string;
  hash: string;
  sandbox: boolean;
}

const STATUS_TONE: Record<PaymentStatus, 'success' | 'danger' | 'neutral'> = {
  PENDING: 'neutral',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function formatLKR(amount: string): string {
  return `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}

/** PayHere checkout is a cross-origin form POST, not an XHR. */
function submitPayhereForm(checkout: PayhereCheckout): void {
  const action = checkout.sandbox
    ? 'https://sandbox.payhere.lk/pay/checkout'
    : 'https://www.payhere.lk/pay/checkout';
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  const fields: Record<string, string> = {
    merchant_id: checkout.merchant_id,
    return_url: checkout.return_url,
    cancel_url: checkout.cancel_url,
    notify_url: checkout.notify_url,
    order_id: checkout.order_id,
    items: checkout.items,
    currency: checkout.currency,
    amount: checkout.amount,
    hash: checkout.hash,
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export default function DoctorPayments() {
  const t = useTranslations('payments');
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [slipUploading, setSlipUploading] = useState(false);

  const { data: payments, isLoading } = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api<PaymentRow[]>('/payments/mine'),
  });

  const payhere = useMutation({
    mutationFn: () =>
      api<{ checkout: PayhereCheckout }>('/payments/payhere/checkout', {
        method: 'POST',
        body: JSON.stringify({ type: 'SUBSCRIPTION' }),
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
    onSuccess: ({ checkout }) => submitPayhereForm(checkout),
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : 'generic';
      toast({
        title: code === 'doctor_profile_not_found' ? t('noProfile') : t('checkoutFailed'),
        tone: 'error',
      });
    },
  });

  async function uploadSlip(file: File): Promise<void> {
    setSlipUploading(true);
    try {
      const body = new FormData();
      body.append('type', 'SUBSCRIPTION');
      body.append('file', file);
      // Plain fetch: FormData must set its own multipart boundary header.
      const res = await fetch(`${API_URL}/payments/slip`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new ApiError(res.status, err.message ?? `http_${res.status}`);
      }
      toast({ title: t('slipUploaded'), tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['my-payments'] });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'generic';
      toast({
        title:
          code === 'unsupported_file_type'
            ? t('slipBadType')
            : code === 'file_too_large'
              ? t('slipTooLarge')
              : t('slipFailed'),
        tone: 'error',
      });
    } finally {
      setSlipUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Link href="/doctor" className="text-sm font-semibold text-primary-700">
          {t('backToDashboard')}
        </Link>
      </header>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">{t('subscription.title')}</h2>
          <p className="text-sm text-muted mt-1">{t('subscription.body')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button loading={payhere.isPending} onClick={() => payhere.mutate()}>
            {t('payWithPayhere')}
          </Button>
          <Button
            variant="secondary"
            loading={slipUploading}
            onClick={() => fileRef.current?.click()}
          >
            {t('uploadSlip')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadSlip(file);
            }}
          />
        </div>
        <p className="text-xs text-muted">{t('slipHint')}</p>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t('history')}
        </h2>
        {isLoading ? (
          <Skeleton height={120} />
        ) : !payments?.length ? (
          <EmptyState title={t('empty.title')} body={t('empty.body')} />
        ) : (
          payments.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">
                  {t(`type.${p.type}`)} · {t(`method.${p.method}`)}
                </p>
                <p className="text-xs text-muted mq-tabular">
                  {new Date(p.createdAt).toLocaleDateString('en-GB', {
                    timeZone: 'Asia/Colombo',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold mq-tabular text-sm">{formatLKR(p.amountLKR)}</span>
                <Badge tone={STATUS_TONE[p.status]}>{t(`status.${p.status}`)}</Badge>
              </div>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
