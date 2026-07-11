import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../../infra/storage/storage.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  async overview() {
    // "Today" in Asia/Colombo (UTC+05:30, no DST), expressed as a UTC instant.
    const COLOMBO_OFFSET_MS = 5.5 * 3_600_000;
    const DAY_MS = 86_400_000;
    const todayStart = new Date(
      Math.floor((Date.now() + COLOMBO_OFFSET_MS) / DAY_MS) * DAY_MS - COLOMBO_OFFSET_MS,
    );
    const [activeSessions, bookingsToday, pendingDoctors, pendingPayments, totalPatients] =
      await Promise.all([
        this.prisma.session.count({ where: { status: { in: ['LIVE', 'PAUSED'] } } }),
        this.prisma.appointment.count({ where: { bookedAt: { gte: todayStart } } }),
        this.prisma.doctorProfile.count({ where: { approvalStatus: 'PENDING' } }),
        this.prisma.payment.count({ where: { status: 'PENDING', method: 'BANK_SLIP' } }),
        this.prisma.user.count({ where: { role: 'PATIENT', deletedAt: null } }),
      ]);
    return { activeSessions, bookingsToday, pendingDoctors, pendingPayments, totalPatients };
  }

  async pendingDoctors(take = 50) {
    const profiles = await this.prisma.doctorProfile.findMany({
      where: { approvalStatus: 'PENDING' },
      include: {
        user: { select: { id: true, phone: true, name: true, createdAt: true } },
        dispensaries: true,
      },
      orderBy: { createdAt: 'asc' },
      take,
    });
    return Promise.all(
      profiles.map(async (p) => ({
        ...p,
        photoUrl: p.photoUrl ? await this.storage.signedUrl(p.photoUrl) : null,
      })),
    );
  }

  async approveDoctor(adminId: string, profileId: string, ip?: string) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('doctor_profile_not_found');
    if (profile.approvalStatus !== 'PENDING') throw new BadRequestException('not_pending');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.doctorProfile.update({
        where: { id: profileId },
        data: {
          approvalStatus: 'APPROVED',
          approvedByAdminId: adminId,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
      await this.audit.log(
        {
          actorId: adminId,
          action: 'doctor.approved',
          entityType: 'DoctorProfile',
          entityId: profileId,
          before: { approvalStatus: profile.approvalStatus },
          after: { approvalStatus: 'APPROVED' },
          ip,
        },
        tx,
      );
      return row;
    });

    this.events.emit('doctor.approved', { profileId, userId: profile.userId });
    return updated;
  }

  async rejectDoctor(adminId: string, profileId: string, reason: string, ip?: string) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('doctor_profile_not_found');
    if (profile.approvalStatus !== 'PENDING') throw new BadRequestException('not_pending');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.doctorProfile.update({
        where: { id: profileId },
        data: { approvalStatus: 'REJECTED', rejectionReason: reason },
      });
      await this.audit.log(
        {
          actorId: adminId,
          action: 'doctor.rejected',
          entityType: 'DoctorProfile',
          entityId: profileId,
          before: { approvalStatus: profile.approvalStatus },
          after: { approvalStatus: 'REJECTED', reason },
          ip,
        },
        tx,
      );
      return row;
    });

    this.events.emit('doctor.rejected', { profileId, userId: profile.userId, reason });
    return updated;
  }

  async listUsers(params: { q?: string; role?: string; status?: string; take?: number }) {
    return this.prisma.user.findMany({
      where: {
        role: params.role as never,
        status: params.status as never,
        ...(params.q
          ? {
              OR: [
                { phone: { contains: params.q } },
                { name: { contains: params.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.take ?? 50, 200),
    });
  }

  async setUserStatus(adminId: string, userId: string, status: UserStatus, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user_not_found');
    if (user.role === 'ADMIN') throw new BadRequestException('cannot_modify_admin');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { status } });
      if (status !== 'ACTIVE') {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.log(
        {
          actorId: adminId,
          action: `user.status.${status.toLowerCase()}`,
          entityType: 'User',
          entityId: userId,
          before: { status: user.status },
          after: { status },
          ip,
        },
        tx,
      );
      return { id: updated.id, status: updated.status };
    });
  }

  auditLogs(params: { entityType?: string; entityId?: string; take?: number; cursor?: string }) {
    return this.audit.list(params);
  }
}
