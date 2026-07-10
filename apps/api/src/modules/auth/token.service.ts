import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ENV, type Env } from '../../config/env';
import type { UserRole } from '@prisma/client';

export interface AccessPayload {
  sub: string;
  role: UserRole;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

function parseTtlMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) throw new Error(`invalid TTL: ${ttl}`);
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  signAccessToken(payload: AccessPayload): string {
    return this.jwt.sign(
      { ...payload },
      {
        secret: this.env.JWT_ACCESS_SECRET,
        expiresIn: Math.floor(parseTtlMs(this.env.ACCESS_TOKEN_TTL) / 1000),
      },
    );
  }

  verifyAccessToken(token: string): AccessPayload {
    try {
      return this.jwt.verify<AccessPayload>(token, { secret: this.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('invalid_access_token');
    }
  }

  /** Issue a brand-new token pair starting a fresh refresh-token family. */
  async issueTokens(payload: AccessPayload): Promise<IssuedTokens> {
    return this.mintPair(payload, randomUUID());
  }

  private async mintPair(payload: AccessPayload, familyId: string): Promise<IssuedTokens> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + parseTtlMs(this.env.REFRESH_TOKEN_TTL));

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken: this.signAccessToken(payload),
      refreshToken,
      refreshExpiresAt,
    };
  }

  /**
   * Rotate a refresh token. If a revoked/already-replaced token is presented,
   * the whole family is revoked (token theft assumption).
   */
  async rotate(presentedToken: string): Promise<IssuedTokens & { userId: string }> {
    const tokenHash = this.hashToken(presentedToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) throw new UnauthorizedException('invalid_refresh_token');

    if (record.revokedAt || record.replacedBy) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('refresh_token_reuse_detected');
    }
    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh_token_expired');
    }
    if (record.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('account_disabled');
    }

    const pair = await this.mintPair(
      { sub: record.userId, role: record.user.role },
      record.familyId,
    );
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: this.hashToken(pair.refreshToken) },
    });

    return { ...pair, userId: record.userId };
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByToken(presentedToken: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(presentedToken) },
    });
    if (record) await this.revokeFamily(record.familyId);
  }
}
