import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QueueStateService } from './queue-state.service';
import { QueueEvents, type QueueStateChangedPayload } from './queue.events';

const MAX_ACTIVE_BOOKINGS_PLATFORM = 3;

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: QueueStateService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ---------- helpers ----------

  private async requireDoctorSession(doctorUserId: string, sessionId: string, role?: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { schedule: { include: { dispensary: { include: { doctor: true } } } } },
    });
    if (!session) throw new NotFoundException('session_not_found');
    if (role !== 'ADMIN' && session.schedule.dispensary.doctor.userId !== doctorUserId) {
      throw new ForbiddenException('not_your_session');
    }
    return session;
  }

  private async broadcast(sessionId: string): Promise<void> {
    const [state, waiting] = await Promise.all([
      this.state.getState(sessionId),
      this.state.waitingOwners(sessionId),
    ]);
    const avg = state.avgConsultMinutes;
    const payload: QueueStateChangedPayload = {
      state,
      you: waiting.map(({ token, patientId }, index) => ({
        patientId,
        you: {
          sessionId,
          yourToken: token,
          position: index,
          etaMinutes: QueueStateService.computeEta(index, avg),
          status: 'BOOKED',
        },
      })),
    };
    this.events.emit(QueueEvents.QueueAdvanced, payload);
  }

  // ---------- session lifecycle (doctor) ----------

  async startSession(doctorUserId: string, scheduleId: string, role?: string) {
    const schedule = await this.prisma.sessionSchedule.findUnique({
      where: { id: scheduleId },
      include: { dispensary: { include: { doctor: true } } },
    });
    if (!schedule) throw new NotFoundException('schedule_not_found');
    if (role !== 'ADMIN' && schedule.dispensary.doctor.userId !== doctorUserId) {
      throw new ForbiddenException('not_your_schedule');
    }
    if (schedule.dispensary.doctor.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('doctor_not_approved');
    }

    const today = new Date(new Date().toISOString().slice(0, 10));
    const session = await this.prisma.session.upsert({
      where: { scheduleId_date: { scheduleId, date: today } },
      create: {
        scheduleId,
        date: today,
        status: 'LIVE',
        startedAt: new Date(),
      },
      update: { status: 'LIVE', startedAt: new Date() },
    });

    await this.state.initSession(session.id, schedule.avgConsultMinutes);

    // Pre-booked appointments (booked before the doctor went live) enter the queue.
    const booked = await this.prisma.appointment.findMany({
      where: { sessionId: session.id, status: 'BOOKED' },
      orderBy: { tokenNumber: 'asc' },
    });
    for (const appt of booked) {
      await this.state.addWaiting(session.id, appt.tokenNumber, appt.patientId);
    }

    await this.audit.log({
      actorId: doctorUserId,
      action: 'session.started',
      entityType: 'Session',
      entityId: session.id,
    });
    this.events.emit(QueueEvents.SessionStarted, { sessionId: session.id });
    await this.broadcast(session.id);
    return session;
  }

  async pauseSession(doctorUserId: string, sessionId: string, role?: string) {
    const session = await this.requireDoctorSession(doctorUserId, sessionId, role);
    if (session.status !== 'LIVE') throw new BadRequestException('session_not_live');
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'PAUSED' },
    });
    await this.state.setStatus(sessionId, 'PAUSED');
    await this.audit.log({
      actorId: doctorUserId,
      action: 'session.paused',
      entityType: 'Session',
      entityId: sessionId,
    });
    await this.broadcast(sessionId);
    return updated;
  }

  async resumeSession(doctorUserId: string, sessionId: string, role?: string) {
    const session = await this.requireDoctorSession(doctorUserId, sessionId, role);
    if (session.status !== 'PAUSED') throw new BadRequestException('session_not_paused');
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'LIVE' },
    });
    await this.state.setStatus(sessionId, 'LIVE');
    await this.broadcast(sessionId);
    return updated;
  }

  /** End session: reconcile Redis → Postgres, cancel unserved bookings. */
  async endSession(doctorUserId: string, sessionId: string, role?: string) {
    const session = await this.requireDoctorSession(doctorUserId, sessionId, role);
    if (session.status !== 'LIVE' && session.status !== 'PAUSED') {
      throw new BadRequestException('session_not_active');
    }

    await this.completeCurrent(sessionId);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { sessionId, status: 'BOOKED' },
        data: { status: 'CANCELLED' },
      });
      const row = await tx.session.update({
        where: { id: sessionId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      await this.audit.log(
        {
          actorId: doctorUserId,
          action: 'session.ended',
          entityType: 'Session',
          entityId: sessionId,
        },
        tx,
      );
      return row;
    });

    await this.state.setStatus(sessionId, 'ENDED');
    await this.broadcast(sessionId);
    await this.state.clear(sessionId);
    this.events.emit(QueueEvents.SessionEnded, { sessionId });
    return updated;
  }

  /** Complete whoever is currently IN_CONSULT, recording the real duration. */
  private async completeCurrent(sessionId: string): Promise<void> {
    const current = await this.prisma.appointment.findFirst({
      where: { sessionId, status: 'IN_CONSULT' },
    });
    if (!current) return;
    const durationSecs = current.calledAt
      ? (Date.now() - current.calledAt.getTime()) / 1000
      : 0;
    await this.prisma.appointment.update({
      where: { id: current.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (durationSecs > 0) await this.state.recordConsult(sessionId, durationSecs);
    else await this.state.incrementServed(sessionId);
  }

  /** Doctor taps "Next": completes the current consult and calls the next token. */
  async advance(doctorUserId: string, sessionId: string, role?: string) {
    const session = await this.requireDoctorSession(doctorUserId, sessionId, role);
    if (session.status !== 'LIVE') throw new BadRequestException('session_not_live');

    await this.completeCurrent(sessionId);
    const nextToken = await this.state.popNext(sessionId);

    if (nextToken === null) {
      await this.broadcast(sessionId);
      return { currentToken: session.currentToken, queueEmpty: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { sessionId, tokenNumber: nextToken, status: 'BOOKED' },
        data: { status: 'IN_CONSULT', calledAt: new Date() },
      });
      await tx.session.update({
        where: { id: sessionId },
        data: { currentToken: nextToken },
      });
      await this.audit.log(
        {
          actorId: doctorUserId,
          action: 'queue.advanced',
          entityType: 'Session',
          entityId: sessionId,
          after: { currentToken: nextToken },
        },
        tx,
      );
    });

    await this.broadcast(sessionId);
    return { currentToken: nextToken, queueEmpty: false };
  }

  /** Doctor marks the currently-called patient a no-show and moves on. */
  async markNoShow(doctorUserId: string, sessionId: string, role?: string) {
    const session = await this.requireDoctorSession(doctorUserId, sessionId, role);
    if (session.status !== 'LIVE') throw new BadRequestException('session_not_live');

    const current = await this.prisma.appointment.findFirst({
      where: { sessionId, status: 'IN_CONSULT' },
    });
    if (!current) throw new BadRequestException('no_patient_in_consult');

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: current.id },
        data: { status: 'NO_SHOW' },
      });
      await this.audit.log(
        {
          actorId: doctorUserId,
          action: 'queue.no_show',
          entityType: 'Appointment',
          entityId: current.id,
          after: { tokenNumber: current.tokenNumber },
        },
        tx,
      );
    });
    await this.state.incrementServed(sessionId);

    return this.advance(doctorUserId, sessionId, role);
  }

  // ---------- booking (patient) ----------

  /**
   * Book a token. Token numbers are issued atomically: the session row is
   * locked with SELECT ... FOR UPDATE, so concurrent bookings serialize; the
   * (sessionId, tokenNumber) unique constraint is the backstop.
   */
  async book(patientId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { schedule: true },
    });
    if (!session) throw new NotFoundException('session_not_found');
    if (session.status === 'ENDED' || session.status === 'CANCELLED') {
      throw new BadRequestException('session_over');
    }

    const appointment = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;

        const [activeHere, activeAnywhere, issued] = await Promise.all([
          tx.appointment.count({
            where: { sessionId, patientId, status: { in: ['BOOKED', 'IN_CONSULT'] } },
          }),
          tx.appointment.count({
            where: {
              patientId,
              status: { in: ['BOOKED', 'IN_CONSULT'] },
              session: { status: { in: ['SCHEDULED', 'LIVE', 'PAUSED'] } },
            },
          }),
          tx.appointment.count({ where: { sessionId } }),
        ]);

        if (activeHere > 0) throw new ConflictException('already_booked_this_session');
        if (activeAnywhere >= MAX_ACTIVE_BOOKINGS_PLATFORM) {
          throw new ConflictException('max_active_bookings_reached');
        }
        if (issued >= session.schedule.maxPatients) {
          throw new ConflictException('session_full');
        }

        const agg = await tx.appointment.aggregate({
          where: { sessionId },
          _max: { tokenNumber: true },
        });
        const tokenNumber = (agg._max.tokenNumber ?? 0) + 1;

        return tx.appointment.create({
          data: { sessionId, patientId, tokenNumber },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    if (session.status === 'LIVE' || session.status === 'PAUSED') {
      await this.state.addWaiting(sessionId, appointment.tokenNumber, patientId);
      await this.broadcast(sessionId);
    }
    this.events.emit(QueueEvents.PatientBooked, { sessionId, patientId });
    return appointment;
  }

  async cancelBooking(patientId: string, appointmentId: string) {
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt || appt.patientId !== patientId) throw new NotFoundException('appointment_not_found');
    if (appt.status !== 'BOOKED') throw new BadRequestException('cannot_cancel');

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });
    await this.state.removeWaiting(appt.sessionId, appt.tokenNumber);
    await this.broadcast(appt.sessionId);
    return { cancelled: true };
  }

  /**
   * No-show rejoin: allowed once per session; the patient re-enters at the
   * tail with a fresh token.
   */
  async rejoin(patientId: string, sessionId: string) {
    const noShow = await this.prisma.appointment.findFirst({
      where: { sessionId, patientId, status: 'NO_SHOW' },
      orderBy: { tokenNumber: 'desc' },
    });
    if (!noShow) throw new BadRequestException('no_noshow_to_rejoin');

    const alreadyRejoined = await this.prisma.appointment.findFirst({
      where: { sessionId, patientId, rejoinedFromToken: { not: null } },
    });
    if (alreadyRejoined) throw new ConflictException('rejoin_already_used');

    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'LIVE') throw new BadRequestException('session_not_live');

    const appointment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
      const agg = await tx.appointment.aggregate({
        where: { sessionId },
        _max: { tokenNumber: true },
      });
      return tx.appointment.create({
        data: {
          sessionId,
          patientId,
          tokenNumber: (agg._max.tokenNumber ?? 0) + 1,
          rejoinedFromToken: noShow.tokenNumber,
        },
      });
    });

    await this.state.addWaiting(sessionId, appointment.tokenNumber, patientId);
    await this.broadcast(sessionId);
    return appointment;
  }

  // ---------- reads ----------

  async myAppointments(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      include: {
        session: {
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
          },
        },
      },
      orderBy: { bookedAt: 'desc' },
      take: 50,
    });
  }

  async ticketFor(patientId: string, sessionId: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: {
        sessionId,
        patientId,
        status: { in: ['BOOKED', 'IN_CONSULT', 'NO_SHOW'] },
      },
      orderBy: { tokenNumber: 'desc' },
    });
    if (!appt) throw new NotFoundException('appointment_not_found');
    const [state, you] = await Promise.all([
      this.state.getState(sessionId),
      this.state.youFor(sessionId, appt.tokenNumber, appt.status),
    ]);
    return { state, you };
  }
}
