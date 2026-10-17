import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { normalizeLkPhone } from '@medqueue/shared';
import type { Locale, Specialty, User } from '@prisma/client';
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

  async requestOtp(rawPhone: string, ip: string): Promise<string> {
    return this.otp.request(this.normalize(rawPhone), ip);
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

  /**
   * Phone + NIC (as password) Login.
   * Also handles hardcoded admin credentials:
   * username: 0718797487, pass: 963501978V
   */
  async login(
    identifier: string,
    pass: string,
  ): Promise<{ user: User; tokens: IssuedTokens; isNew: boolean }> {
    const rawId = identifier.trim();
    const cleanPass = pass.trim();

    // 1. Hardcoded Admin Authentication
    if (
      (rawId === '0718797487' || rawId === '+94718797487' || rawId === 'admin') &&
      cleanPass === '963501978V'
    ) {
      let admin = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phone: '+94718797487' },
            { phone: '0718797487' },
            { nic: '963501978V' },
          ],
        },
      });

      if (!admin) {
        admin = await this.prisma.user.create({
          data: {
            phone: '+94718797487',
            nic: '963501978V',
            name: 'System Admin',
            role: 'ADMIN',
            status: 'ACTIVE',
            pdpaConsentAt: new Date(),
          },
        });
      } else if (admin.role !== 'ADMIN' || admin.nic !== '963501978V') {
        admin = await this.prisma.user.update({
          where: { id: admin.id },
          data: { role: 'ADMIN', nic: '963501978V' },
        });
      }

      const tokens = await this.tokens.issueTokens({ sub: admin.id, role: 'ADMIN' });
      return { user: admin, tokens, isNew: false };
    }

    // 2. Phone + NIC (Password) lookup for Patient and Doctor
    const normalizedPhone = normalizeLkPhone(rawId);
    const passUpper = cleanPass.toUpperCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          { phone: rawId },
          { nic: rawId.toUpperCase() },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('invalid_credentials');
    }

    if (user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('account_disabled');
    }

    const isNicMatch = user.nic && user.nic.toUpperCase() === passUpper;
    const isDevOtpBypass = process.env.NODE_ENV !== 'production' && cleanPass === '123456';
    const isAdminPassMatch = user.role === 'ADMIN' && cleanPass === '963501978V';

    if (!isNicMatch && !isDevOtpBypass && !isAdminPassMatch) {
      throw new UnauthorizedException('invalid_credentials');
    }

    const tokens = await this.tokens.issueTokens({ sub: user.id, role: user.role });
    return { user, tokens, isNew: false };
  }

  /**
   * Register a new Patient with Phone + NIC (as password).
   */
  async registerPatient(dto: {
    phone: string;
    nic: string;
    name: string;
    preferredLanguage?: Locale;
  }): Promise<{ user: User; tokens: IssuedTokens; isNew: boolean }> {
    const phone = this.normalize(dto.phone);
    const nic = dto.nic.trim().toUpperCase();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, { nic }] },
    });
    if (existing) {
      if (existing.phone === phone) throw new BadRequestException('phone_already_registered');
      if (existing.nic === nic) throw new BadRequestException('nic_already_registered');
    }

    const user = await this.prisma.user.create({
      data: {
        phone,
        nic,
        name: dto.name.trim(),
        role: 'PATIENT',
        preferredLanguage: dto.preferredLanguage ?? 'en',
        pdpaConsentAt: new Date(),
      },
    });

    const tokens = await this.tokens.issueTokens({ sub: user.id, role: user.role });
    return { user, tokens, isNew: true };
  }

  /**
   * Register a new Doctor with Phone + NIC (as password), SLMC, Specialty & Dispensary.
   */
  async registerDoctor(dto: {
    phone: string;
    nic: string;
    name: string;
    slmcRegNo: string;
    specialty: string;
    consultationFeeLKR?: number;
    dispensaryName: string;
    town: string;
    district: string;
    addressLine?: string;
    bio?: string;
  }): Promise<{ user: User; tokens: IssuedTokens; isNew: boolean }> {
    const phone = this.normalize(dto.phone);
    const nic = dto.nic.trim().toUpperCase();
    const slmc = dto.slmcRegNo.trim();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, { nic }] },
    });
    if (existing) {
      if (existing.phone === phone) throw new BadRequestException('phone_already_registered');
      if (existing.nic === nic) throw new BadRequestException('nic_already_registered');
    }

    const existingSlmc = await this.prisma.doctorProfile.findUnique({
      where: { slmcRegNo: slmc },
    });
    if (existingSlmc) throw new BadRequestException('slmc_already_registered');

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          nic,
          name: dto.name.trim(),
          role: 'DOCTOR',
          preferredLanguage: 'en',
          pdpaConsentAt: new Date(),
        },
      });

      const profile = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          slmcRegNo: slmc,
          specialty: dto.specialty as Specialty,
          consultationFeeLKR: dto.consultationFeeLKR ?? 1500,
          bio: dto.bio?.trim() ?? null,
          approvalStatus: 'APPROVED', // Immediately approved for active operation
          approvedAt: new Date(),
        },
      });

      const dispensary = await tx.dispensary.create({
        data: {
          doctorId: profile.id,
          name: dto.dispensaryName.trim(),
          town: dto.town.trim(),
          district: dto.district.trim(),
          addressLine: dto.addressLine?.trim() || `${dto.town} Medical Centre`,
          contactPhone: phone,
          lat: 6.9271,
          lng: 79.8612,
        },
      });

      await tx.sessionSchedule.create({
        data: {
          dispensaryId: dispensary.id,
          dayOfWeek: new Date().getDay(),
          startTime: '17:00',
          endTime: '20:00',
          maxPatients: 50,
          avgConsultMinutes: 10,
        },
      });

      return user;
    });

    const tokens = await this.tokens.issueTokens({ sub: result.id, role: 'DOCTOR' });
    return { user: result, tokens, isNew: true };
  }
}
