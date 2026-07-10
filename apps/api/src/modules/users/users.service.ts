import { Injectable, NotFoundException } from '@nestjs/common';
import type { Locale } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../auth/token.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        role: true,
        name: true,
        preferredLanguage: true,
        status: true,
        createdAt: true,
        doctorProfile: {
          select: {
            id: true,
            slmcRegNo: true,
            specialty: true,
            approvalStatus: true,
            photoUrl: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('user_not_found');
    return user;
  }

  updateProfile(userId: string, data: { name?: string; preferredLanguage?: Locale }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, preferredLanguage: true },
    });
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        doctorProfile: { include: { dispensaries: true, payments: true } },
        appointments: true,
        notifications: true,
      },
    });
    if (!user) throw new NotFoundException('user_not_found');
    return { exportedAt: new Date().toISOString(), data: user };
  }

  async softDelete(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), status: 'SUSPENDED' },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
