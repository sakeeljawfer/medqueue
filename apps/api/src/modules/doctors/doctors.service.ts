import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import type { CreateDispensaryDto, CreateDoctorProfileDto, CreateScheduleDto } from './dto/doctors.dto';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async createProfile(userId: string, dto: CreateDoctorProfileDto) {
    const existing = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('doctor_profile_exists');

    const clash = await this.prisma.doctorProfile.findUnique({
      where: { slmcRegNo: dto.slmcRegNo },
    });
    if (clash) throw new ConflictException('slmc_reg_no_in_use');

    const [profile] = await this.prisma.$transaction([
      this.prisma.doctorProfile.create({
        data: {
          userId,
          slmcRegNo: dto.slmcRegNo,
          specialty: dto.specialty,
          bio: dto.bio,
          consultationFeeLKR: dto.consultationFeeLKR,
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { role: 'DOCTOR' } }),
    ]);

    await this.audit.log({
      actorId: userId,
      action: 'doctor.profile.created',
      entityType: 'DoctorProfile',
      entityId: profile.id,
      after: { slmcRegNo: dto.slmcRegNo, specialty: dto.specialty },
    });
    return profile;
  }

  /** Doctor's own profile, or 404 if they haven't started onboarding. */
  async getOwnProfile(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: { dispensaries: { include: { schedules: true } } },
    });
    if (!profile) throw new NotFoundException('doctor_profile_not_found');
    return profile;
  }

  private async requireOwnProfile(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('doctor_profile_not_found');
    return profile;
  }

  async setPhoto(userId: string, buffer: Buffer) {
    const profile = await this.requireOwnProfile(userId);
    const key = await this.storage.putImage('doctor-photos', buffer);
    await this.prisma.doctorProfile.update({
      where: { id: profile.id },
      data: { photoUrl: key },
    });
    return { photoUrl: await this.storage.signedUrl(key) };
  }

  async addDispensary(userId: string, dto: CreateDispensaryDto) {
    const profile = await this.requireOwnProfile(userId);
    return this.prisma.dispensary.create({ data: { ...dto, doctorId: profile.id } });
  }

  async addSchedule(userId: string, dto: CreateScheduleDto) {
    const profile = await this.requireOwnProfile(userId);
    const dispensary = await this.prisma.dispensary.findUnique({
      where: { id: dto.dispensaryId },
    });
    if (!dispensary) throw new NotFoundException('dispensary_not_found');
    if (dispensary.doctorId !== profile.id) throw new ForbiddenException('not_your_dispensary');
    if (dto.endTime <= dto.startTime) throw new BadRequestException('end_before_start');

    const { dispensaryId, ...rest } = dto;
    return this.prisma.sessionSchedule.create({
      data: { ...rest, dispensaryId },
    });
  }
}
