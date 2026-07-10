import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { normalizeLkPhone } from '@medqueue/shared';
import type { Locale, User } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService, type IssuedTokens } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  private normalize(rawPhone: string): string {
    const phone = normalizeLkPhone(rawPhone);
    if (!phone) throw new BadRequestException('invalid_lk_mobile');
    return phone;
  }

  async requestOtp(rawPhone: string, ip: string): Promise<void> {
    await this.otp.request(this.normalize(rawPhone), ip);
  }

  async verifyOtp(input: {
    phone: string;
    code: string;
    name?: string;
    preferredLanguage?: Locale;
    pdpaConsent?: boolean;
  }): Promise<{ user: User; tokens: IssuedTokens; isNew: boolean }> {
    const phone = this.normalize(input.phone);
    await this.otp.verify(phone, input.code);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNew = false;

    if (!user) {
      // PDPA No. 9 of 2022: explicit consent is required to create the account.
      if (!input.pdpaConsent) throw new BadRequestException('pdpa_consent_required');
      user = await this.prisma.user.create({
        data: {
          phone,
          name: input.name,
          preferredLanguage: input.preferredLanguage ?? 'en',
          pdpaConsentAt: new Date(),
        },
      });
      isNew = true;
    } else {
      if (user.status !== 'ACTIVE' || user.deletedAt) {
        throw new UnauthorizedException('account_disabled');
      }
      if (input.name || input.preferredLanguage) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: input.name ?? user.name,
            preferredLanguage: input.preferredLanguage ?? user.preferredLanguage,
          },
        });
      }
    }

    const tokens = await this.tokens.issueTokens({ sub: user.id, role: user.role });
    return { user, tokens, isNew };
  }
}
