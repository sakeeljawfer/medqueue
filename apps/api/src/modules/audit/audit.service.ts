import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/**
 * Append-only audit trail. Called on every admin mutation and every queue
 * state change. There is deliberately no update/delete API.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before === undefined ? undefined : (entry.before as Prisma.InputJsonValue),
        after: entry.after === undefined ? undefined : (entry.after as Prisma.InputJsonValue),
        ip: entry.ip,
      },
    });
  }

  list(params: { entityType?: string; entityId?: string; actorId?: string; take?: number; cursor?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: params.entityType,
        entityId: params.entityId,
        actorId: params.actorId,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.take ?? 50, 200),
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  }
}
