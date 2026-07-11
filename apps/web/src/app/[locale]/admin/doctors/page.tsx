'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Skeleton,
  TextArea,
  useToast,
} from '@medqueue/ui';
import { api } from '@/lib/api';

interface PendingDoctor {
  id: string;
  slmcRegNo: string;
  specialty: string;
  bio: string;
  photoUrl: string | null;
  consultationFee: string;
  createdAt: string;
  user: { id: string; name: string | null; phone: string; createdAt: string };
  dispensaries: Array<{ id: string; name: string; town: string; district: string }>;
}

function formatLKR(amount: string): string {
  return `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}

export default function DoctorApprovalQueue() {
  const t = useTranslations('admin.doctors');
  const tSpecialty = useTranslations('specialty');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<PendingDoctor | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-pending-doctors'],
    queryFn: () => api<PendingDoctor[]>('/admin/doctors/pending'),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api(`/admin/doctors/${id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: approve ? undefined : JSON.stringify({ reason }),
      }),
    onSuccess: (_, vars) => {
      toast({ title: vars.approve ? t('approved') : t('rejected'), tone: 'success' });
      setRejecting(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-doctors'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: () => toast({ title: t('decisionFailed'), tone: 'error' }),
  });

  return (
    <main className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {isLoading ? (
        <>
          <Skeleton height={180} />
          <Skeleton height={180} />
        </>
      ) : !data?.length ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        data.map((doctor) => (
          <Card key={doctor.id} className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <Avatar src={doctor.photoUrl} name={doctor.user.name ?? '?'} size={56} />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold">{doctor.user.name ?? doctor.user.phone}</h2>
                <p className="text-sm text-muted">
                  {tSpecialty(doctor.specialty)} · {formatLKR(doctor.consultationFee)}
                </p>
                <p className="text-sm mt-1">
                  {t('slmc')}:{' '}
                  <span className="font-semibold mq-tabular">{doctor.slmcRegNo}</span>
                </p>
              </div>
              <Badge tone="neutral">
                {t('applied', {
                  date: new Date(doctor.createdAt).toLocaleDateString('en-GB', {
                    timeZone: 'Asia/Colombo',
                    day: '2-digit',
                    month: 'short',
                  }),
                })}
              </Badge>
            </div>

            {doctor.bio && <p className="text-sm text-muted">{doctor.bio}</p>}

            <div className="flex flex-wrap gap-2">
              {doctor.dispensaries.map((d) => (
                <Badge key={d.id} tone="neutral">
                  {d.name}, {d.town} · {d.district}
                </Badge>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                loading={decide.isPending && decide.variables?.id === doctor.id && decide.variables.approve}
                onClick={() => decide.mutate({ id: doctor.id, approve: true })}
              >
                {t('approve')}
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(doctor)}>
                {t('reject')}
              </Button>
            </div>
          </Card>
        ))
      )}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title={t('rejectDialog.title')}
        description={t('rejectDialog.body', {
          name: rejecting?.user.name ?? rejecting?.user.phone ?? '',
        })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              {t('rejectDialog.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={decide.isPending && decide.variables?.approve === false}
              onClick={() =>
                rejecting && decide.mutate({ id: rejecting.id, approve: false, reason: reason.trim() })
              }
            >
              {t('rejectDialog.confirm')}
            </Button>
          </>
        }
      >
        <TextArea
          label={t('rejectDialog.reasonLabel')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={t('rejectDialog.reasonPlaceholder')}
        />
      </Dialog>
    </main>
  );
}
