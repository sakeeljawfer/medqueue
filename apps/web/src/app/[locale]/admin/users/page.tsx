'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Badge, Button, Card, Dialog, Select, Skeleton, TextField, useToast } from '@medqueue/ui';
import { api } from '@/lib/api';

type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

interface UserRow {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

const STATUS_TONE: Record<UserStatus, 'success' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  SUSPENDED: 'neutral',
  BANNED: 'danger',
};

const columnHelper = createColumnHelper<UserRow>();

export default function UserManagement() {
  const t = useTranslations('admin.users');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [pending, setPending] = useState<{ user: UserRow; to: UserStatus } | null>(null);

  // Server-side filtering: the query key carries the filters.
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (role !== 'ALL') params.set('role', role);
  if (status !== 'ALL') params.set('status', status);
  const search = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => api<UserRow[]>(`/admin/users${search ? `?${search}` : ''}`),
    placeholderData: (prev) => prev,
  });

  const setUserStatus = useMutation({
    mutationFn: ({ user, to }: { user: UserRow; to: UserStatus }) =>
      api(`/admin/users/${user.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: to }),
      }),
    onSuccess: () => {
      toast({ title: t('statusUpdated'), tone: 'success' });
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast({ title: t('updateFailed'), tone: 'error' }),
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('columns.name'),
        cell: (info) => (
          <span className="font-medium">{info.getValue() ?? <span className="text-muted">—</span>}</span>
        ),
      }),
      columnHelper.accessor('phone', {
        header: t('columns.phone'),
        cell: (info) => <span className="mq-tabular">{info.getValue()}</span>,
      }),
      columnHelper.accessor('role', {
        header: t('columns.role'),
        cell: (info) => t(`role.${info.getValue()}`),
      }),
      columnHelper.accessor('status', {
        header: t('columns.status'),
        cell: (info) => <Badge tone={STATUS_TONE[info.getValue()]}>{t(`status.${info.getValue()}`)}</Badge>,
      }),
      columnHelper.accessor('createdAt', {
        header: t('columns.joined'),
        cell: (info) => (
          <span className="mq-tabular text-muted">
            {new Date(info.getValue()).toLocaleDateString('en-GB', {
              timeZone: 'Asia/Colombo',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const user = row.original;
          if (user.role === 'ADMIN') return null;
          return (
            <div className="flex gap-2 justify-end">
              {user.status !== 'ACTIVE' && (
                <Button size="sm" variant="secondary" onClick={() => setPending({ user, to: 'ACTIVE' })}>
                  {t('actions.reinstate')}
                </Button>
              )}
              {user.status === 'ACTIVE' && (
                <Button size="sm" variant="secondary" onClick={() => setPending({ user, to: 'SUSPENDED' })}>
                  {t('actions.suspend')}
                </Button>
              )}
              {user.status !== 'BANNED' && (
                <Button size="sm" variant="danger" onClick={() => setPending({ user, to: 'BANNED' })}>
                  {t('actions.ban')}
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <TextField
            label={t('searchLabel')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <Select
          aria-label={t('columns.role')}
          value={role}
          onValueChange={setRole}
          options={[
            { value: 'ALL', label: t('allRoles') },
            { value: 'PATIENT', label: t('role.PATIENT') },
            { value: 'DOCTOR', label: t('role.DOCTOR') },
            { value: 'ADMIN', label: t('role.ADMIN') },
          ]}
        />
        <Select
          aria-label={t('columns.status')}
          value={status}
          onValueChange={setStatus}
          options={[
            { value: 'ALL', label: t('allStatuses') },
            { value: 'ACTIVE', label: t('status.ACTIVE') },
            { value: 'SUSPENDED', label: t('status.SUSPENDED') },
            { value: 'BANNED', label: t('status.BANNED') },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton height={320} />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead
                className="sticky top-0 z-10"
                style={{ background: 'var(--mq-surface-raised)' }}
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-4 py-3 border-b"
                        style={{ borderColor: 'var(--mq-line)' }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                      {t('noResults')}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: 'var(--mq-line)' }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? t(`confirm.${pending.to}.title`) : ''}
        description={
          pending
            ? t(`confirm.${pending.to}.body`, {
                name: pending.user.name ?? pending.user.phone,
              })
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {t('confirm.cancel')}
            </Button>
            <Button
              variant={pending?.to === 'ACTIVE' ? 'primary' : 'danger'}
              loading={setUserStatus.isPending}
              onClick={() => pending && setUserStatus.mutate(pending)}
            >
              {pending ? t(`confirm.${pending.to}.confirm`) : ''}
            </Button>
          </>
        }
      />
    </main>
  );
}
