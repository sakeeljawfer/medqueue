import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async todayForDoctor(doctorUserId: string, role?: string) {
    let profile = await this.prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId },
      include: { dispensaries: { include: { schedules: true } } },
    });
    if (!profile && role === 'ADMIN') {
      profile = await this.prisma.doctorProfile.findFirst({
        include: { dispensaries: { include: { schedules: true } } },
      });
    }
    if (!profile) throw new NotFoundException('doctor_profile_not_found');

    const todayStart = new Date(new Date().toISOString().slice(0, 10));
    const dayOfWeek = new Date().getDay();

    const scheduleIds = profile.dispensaries.flatMap((d) => d.schedules.map((s) => s.id));
    const sessions = await this.prisma.session.findMany({
      where: { scheduleId: { in: scheduleIds }, date: todayStart },
      include: { _count: { select: { appointments: true } } },
    });
    const sessionsBySchedule = new Map(sessions.map((s) => [s.scheduleId, s]));

    return profile.dispensaries.map((dispensary) => ({
      id: dispensary.id,
      name: dispensary.name,
      town: dispensary.town,
      schedules: dispensary.schedules
        .filter((s) => s.active && (s.dayOfWeek === dayOfWeek || sessionsBySchedule.has(s.id)))
        .map((schedule) => ({
          ...schedule,
          session: sessionsBySchedule.get(schedule.id) ?? null,
        })),
    }));
  }

  async dispensariesForDoctor(doctorUserId: string, role?: string) {
    let profile = await this.prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId },
      include: { dispensaries: { include: { schedules: true } } },
    });
    if (!profile && role === 'ADMIN') {
      profile = await this.prisma.doctorProfile.findFirst({
        include: { dispensaries: { include: { schedules: true } } },
      });
    }
    if (!profile) throw new NotFoundException('doctor_profile_not_found');
    return profile.dispensaries;
  }

  async createSession(
    doctorUserId: string,
    dto: {
      dispensaryId?: string;
      dispensaryName?: string;
      town?: string;
      district?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      maxPatients?: number;
      avgConsultMinutes?: number;
    },
    role?: string,
  ) {
    let profile = await this.prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId },
      include: { dispensaries: { include: { schedules: true } } },
    });
    if (!profile && role === 'ADMIN') {
      profile = await this.prisma.doctorProfile.findFirst({
        include: { dispensaries: { include: { schedules: true } } },
      });
    }
    if (!profile) throw new NotFoundException('doctor_profile_not_found');

    let dispensary = dto.dispensaryId
      ? profile.dispensaries.find((d) => d.id === dto.dispensaryId)
      : profile.dispensaries[0];

    if (!dispensary) {
      dispensary = await this.prisma.dispensary.create({
        data: {
          doctorId: profile.id,
          name: dto.dispensaryName?.trim() || 'Main Dispensary',
          town: dto.town?.trim() || 'Colombo',
          district: dto.district?.trim() || 'colombo',
          addressLine: 'Main Clinic',
          lat: 6.9271,
          lng: 79.8612,
        },
        include: { schedules: true },
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const sessionDate = dto.date ? new Date(dto.date) : new Date(todayStr);
    const dayOfWeek = sessionDate.getDay();

    let schedule = dispensary.schedules.find((s) => s.dayOfWeek === dayOfWeek);
    if (!schedule) {
      schedule = await this.prisma.sessionSchedule.create({
        data: {
          dispensaryId: dispensary.id,
          dayOfWeek,
          startTime: dto.startTime?.trim() || '17:00',
          endTime: dto.endTime?.trim() || '20:00',
          maxPatients: dto.maxPatients ?? 50,
          avgConsultMinutes: dto.avgConsultMinutes ?? 10,
        },
      });
    } else if (dto.startTime || dto.endTime || dto.maxPatients || dto.avgConsultMinutes) {
      schedule = await this.prisma.sessionSchedule.update({
        where: { id: schedule.id },
        data: {
          startTime: dto.startTime?.trim() ?? schedule.startTime,
          endTime: dto.endTime?.trim() ?? schedule.endTime,
          maxPatients: dto.maxPatients ?? schedule.maxPatients,
          avgConsultMinutes: dto.avgConsultMinutes ?? schedule.avgConsultMinutes,
        },
      });
    }

    const session = await this.prisma.session.upsert({
      where: { scheduleId_date: { scheduleId: schedule.id, date: sessionDate } },
      create: {
        scheduleId: schedule.id,
        date: sessionDate,
        status: 'SCHEDULED',
      },
      update: {
        status: 'SCHEDULED',
      },
      include: {
        schedule: { include: { dispensary: true } },
        _count: { select: { appointments: true } },
      },
    });

    return { session, scheduleId: schedule.id };
  }

  async appointmentsForDoctor(doctorUserId: string, sessionId: string, role?: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { schedule: { include: { dispensary: { include: { doctor: true } } } } },
    });
    if (!session) throw new NotFoundException('session_not_found');
    if (role !== 'ADMIN' && session.schedule.dispensary.doctor.userId !== doctorUserId) {
      throw new ForbiddenException('not_your_session');
    }
    // The doctor legitimately sees patient names — they are treating them.
    return this.prisma.appointment.findMany({
      where: { sessionId },
      include: { patient: { select: { name: true, phone: true } } },
      orderBy: { tokenNumber: 'asc' },
    });
  }

  /** Public view: token numbers and counts only — never patient identities. */
  async publicDetail(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        schedule: {
          include: {
            dispensary: {
              include: {
                doctor: {
                  include: { user: { select: { name: true } } },
                },
              },
            },
          },
        },
        _count: { select: { appointments: true } },
      },
    });
    if (!session) throw new NotFoundException('session_not_found');

    const { schedule } = session;
    return {
      id: session.id,
      date: session.date,
      status: session.status,
      currentToken: session.currentToken,
      bookedCount: session._count.appointments,
      maxPatients: schedule.maxPatients,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      avgConsultMinutes: schedule.avgConsultMinutes,
      dispensary: {
        id: schedule.dispensary.id,
        name: schedule.dispensary.name,
        town: schedule.dispensary.town,
        district: schedule.dispensary.district,
        lat: schedule.dispensary.lat,
        lng: schedule.dispensary.lng,
      },
      doctor: {
        id: schedule.dispensary.doctor.id,
        name: schedule.dispensary.doctor.user.name,
        specialty: schedule.dispensary.doctor.specialty,
        consultationFeeLKR: schedule.dispensary.doctor.consultationFeeLKR,
      },
    };
  }

  async listPublic(params: { doctorId?: string; dispensaryId?: string }) {
    const todayStart = new Date(new Date().toISOString().slice(0, 10));
    return this.prisma.session.findMany({
      where: {
        date: { gte: todayStart },
        status: { in: ['SCHEDULED', 'LIVE', 'PAUSED'] },
        schedule: {
          dispensary: {
            id: params.dispensaryId,
            ...(params.doctorId
              ? {
                  OR: [
                    { doctorId: params.doctorId },
                    { doctor: { userId: params.doctorId } },
                  ],
                }
              : {}),
          },
        },
      },
      select: {
        id: true,
        date: true,
        status: true,
        currentToken: true,
        scheduleId: true,
        schedule: {
          select: { startTime: true, endTime: true, maxPatients: true, dispensaryId: true },
        },
        _count: { select: { appointments: true } },
      },
      orderBy: { date: 'asc' },
      take: 50,
    });
  }
}
