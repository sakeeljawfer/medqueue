import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import type { Env } from '../../config/env';
import type { PrismaService } from '../../infra/prisma/prisma.service';

const env = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '30d',
} as Env;

interface StoredToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
  user: { id: string; role: 'PATIENT'; status: 'ACTIVE' | 'BANNED' };
}

function makeInMemoryPrisma() {
  const rows: StoredToken[] = [];
  let seq = 0;
  return {
    rows,
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Omit<StoredToken, 'id' | 'user' | 'revokedAt' | 'replacedBy'> }) => {
        const row: StoredToken = {
          id: `rt_${++seq}`,
          revokedAt: null,
          replacedBy: null,
          user: { id: data.userId, role: 'PATIENT', status: 'ACTIVE' },
          ...data,
        };
        rows.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        return rows.find((r) => r.tokenHash === where.tokenHash) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<StoredToken> }) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: { familyId: string; revokedAt: null }; data: Partial<StoredToken> }) => {
          for (const row of rows) {
            if (row.familyId === where.familyId && row.revokedAt === null) {
              Object.assign(row, data);
            }
          }
        },
      ),
    },
  };
}

describe('TokenService rotation', () => {
  let prisma: ReturnType<typeof makeInMemoryPrisma>;
  let service: TokenService;

  beforeEach(() => {
    prisma = makeInMemoryPrisma();
    service = new TokenService(new JwtService({}), prisma as unknown as PrismaService, env);
  });

  it('issues an access + refresh pair and verifies the access token', async () => {
    const pair = await service.issueTokens({ sub: 'user_1', role: 'PATIENT' });
    expect(pair.refreshToken).toBeTruthy();
    const payload = service.verifyAccessToken(pair.accessToken);
    expect(payload.sub).toBe('user_1');
    expect(payload.role).toBe('PATIENT');
  });

  it('rotates a refresh token: old one is revoked, new one works', async () => {
    const first = await service.issueTokens({ sub: 'user_1', role: 'PATIENT' });
    const second = await service.rotate(first.refreshToken);
    expect(second.userId).toBe('user_1');
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const third = await service.rotate(second.refreshToken);
    expect(third.userId).toBe('user_1');
  });

  it('detects refresh token reuse and revokes the whole family', async () => {
    const first = await service.issueTokens({ sub: 'user_1', role: 'PATIENT' });
    const second = await service.rotate(first.refreshToken);

    // Replaying the first (already-rotated) token is treated as theft.
    await expect(service.rotate(first.refreshToken)).rejects.toThrow(UnauthorizedException);

    // The whole family — including the newest token — is now dead.
    await expect(service.rotate(second.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown refresh token', async () => {
    await expect(service.rotate('nonsense')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired refresh token', async () => {
    const pair = await service.issueTokens({ sub: 'user_1', role: 'PATIENT' });
    const row = prisma.rows[0]!;
    row.expiresAt = new Date(Date.now() - 1000);
    await expect(service.rotate(pair.refreshToken)).rejects.toThrow('refresh_token_expired');
  });

  it('rejects rotation for a banned user', async () => {
    const pair = await service.issueTokens({ sub: 'user_1', role: 'PATIENT' });
    prisma.rows[0]!.user.status = 'BANNED';
    await expect(service.rotate(pair.refreshToken)).rejects.toThrow('account_disabled');
  });
});
