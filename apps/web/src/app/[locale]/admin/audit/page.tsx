'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, Select, Skeleton } from '@medqueue/ui';
import { api } from '@/lib/api';

interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

const PAGE_SIZE = 50;

const ENTITY_TYPES = ['ALL', 'DoctorProfile', 'User', 'Session', 'Payment'] as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogViewer() {
  const t = useTranslations('admin.audit');
  const [entityType, setEntityType] = useState<string>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin-audit', entityType],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (entityType !== 'ALL') params.set('entityType', entityType);
      if (pageParam) params.set('cursor', pageParam);
      const qs = params.toString();
      return api<AuditRow[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1]?.id : undefined,
  });

  const rows = data?.pages.flat() ?? [];

  return (
    <main className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Select
          aria-label={t('filterLabel')}
          value={entityType}
          onValueChange={setEntityType}
          options={ENTITY_TYPES.map((value) => ({
            value,
            label: value === 'ALL' ? t('allEntities') : value,
          }))}
        />
      </div>

      {isLoading ? (
        <Skeleton height={320} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y" style={{ borderColor: 'var(--mq-line)' }}>
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-surface-sunken transition-colors"
                  onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  aria-expanded={expanded === row.id}
                >
                  <span className="mq-tabular text-xs text-muted w-28 shrink-0">
                    {formatTime(row.createdAt)}
                  </span>
                  <span className="font-medium text-sm flex-1 min-w-0 truncate">{row.action}</span>
                  <Badge tone="neutral">{row.entityType}</Badge>
                </button>
                {expanded === row.id && (
                  <div
                    className="px-5 pb-4 text-xs grid gap-2 sm:grid-cols-2"
                    style={{ background: 'var(--mq-surface-sunken)' }}
                  >
                    <div className="pt-3">
                      <p className="font-semibold text-muted mb-1">{t('before')}</p>
                      <pre className="whitespace-pre-wrap break-all mq-tabular">
                        {row.before ? JSON.stringify(row.before, null, 2) : '—'}
                      </pre>
                    </div>
                    <div className="pt-3">
                      <p className="font-semibold text-muted mb-1">{t('after')}</p>
                      <pre className="whitespace-pre-wrap break-all mq-tabular">
                        {row.after ? JSON.stringify(row.after, null, 2) : '—'}
                      </pre>
                    </div>
                    <p className="text-muted sm:col-span-2 pb-1">
                      {t('actor')}: <span className="mq-tabular">{row.actorId ?? t('system')}</span>
                      {row.ip ? (
                        <>
                          {' · '}IP: <span className="mq-tabular">{row.ip}</span>
                        </>
                      ) : null}
                      {' · '}
                      {row.entityType}/<span className="mq-tabular">{row.entityId}</span>
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasNextPage && (
        <Button
          variant="secondary"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
          className="self-center"
        >
          {t('loadMore')}
        </Button>
      )}
    </main>
  );
}
