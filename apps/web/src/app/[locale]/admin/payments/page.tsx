'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, EmptyState, Skeleton, useToast } from '@medqueue/ui';
import { api } from '@/lib/api';

interface PendingPayment {
  id: string;
  type: 'SUBSCRIPTION' | 'LISTING';
  amountLKR: string;
  slipImageUrl: string | null;
  createdAt: string;
  doctor: { user: { name: string | null; phone: string } };
}

function formatLKR(amount: string): string {
  return `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}

export default function PaymentApprovalQueue() {
  const t = useTranslations('admin.payments');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<PendingPayment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-pending-payments'],
    queryFn: () => api<PendingPayment[]>('/payments/pending'),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api(`/payments/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' }),
    onSuccess: (_, vars) => {
      toast({ title: vars.approve ? t('approved') : t('rejected'), tone: 'success' });
      setViewing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: () => toast({ title: t('decisionFailed'), tone: 'error' }),
  });

  return (
    <main className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {isLoading ? (
        <>
          <Skeleton height={90} />
          <Skeleton height={90} />
        </>
      ) : !data?.length ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        data.map((payment) => (
          <Card key={payment.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {payment.doctor.user.name ?? payment.doctor.user.phone}
              </p>
              <p className="text-xs text-muted mq-tabular">
                {t(`type.${payment.type}`)} ·{' '}
                {new Date(payment.createdAt).toLocaleDateString('en-GB', {
                  timeZone: 'Asia/Colombo',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-semibold mq-tabular text-sm">
                {formatLKR(payment.amountLKR)}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setViewing(payment)}>
                {t('reviewSlip')}
              </Button>
            </div>
          </Card>
        ))
      )}

      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        title={t('slipDialog.title')}
        description={
          viewing
            ? `${viewing.doctor.user.name ?? viewing.doctor.user.phone} · ${formatLKR(viewing.amountLKR)}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="danger"
              loading={decide.isPending && decide.variables?.approve === false}
              onClick={() => viewing && decide.mutate({ id: viewing.id, approve: false })}
            >
              {t('slipDialog.reject')}
            </Button>
            <Button
              loading={decide.isPending && decide.variables?.approve === true}
              onClick={() => viewing && decide.mutate({ id: viewing.id, approve: true })}
            >
              {t('slipDialog.approve')}
            </Button>
          </>
        }
      >
        {viewing?.slipImageUrl ? (
          // Signed URL from object storage; plain <img> because next/image
          // cannot optimise short-lived signed URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={viewing.slipImageUrl}
            alt={t('slipDialog.alt')}
            className="max-h-[60vh] w-full object-contain rounded-card bg-surface-sunken"
          />
        ) : (
          <p className="text-sm text-muted">{t('slipDialog.missing')}</p>
        )}
      </Dialog>
    </main>
  );
}
