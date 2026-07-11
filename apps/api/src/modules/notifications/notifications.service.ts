import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SMS_PROVIDER, type SmsProvider } from './sms/sms.provider';
import { renderTemplate } from './notification-templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  /**
   * Record an in-app notification and (best-effort) send the SMS in the
   * user's preferred language. SMS failure marks the row FAILED but never
   * throws into the calling flow.
   */
  async notify(
    userId: string,
    template: string,
    args: Record<string, string | number>,
    channels: Array<'SMS' | 'INAPP'> = ['INAPP', 'SMS'],
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return;

    const message = renderTemplate(template, user.preferredLanguage, args);

    if (channels.includes('INAPP')) {
      await this.prisma.notification.create({
        data: {
          userId,
          channel: 'INAPP',
          template,
          payload: { args, message },
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    if (channels.includes('SMS')) {
      const row = await this.prisma.notification.create({
        data: { userId, channel: 'SMS', template, payload: { args, message } },
      });
      try {
        await this.sms.send(user.phone, message);
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } catch (err) {
        this.logger.error({ err, userId, template }, 'sms send failed');
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, channel: 'INAPP' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  // ---------- event listeners ----------

  @OnEvent('doctor.approved')
  async onDoctorApproved(payload: { userId: string }): Promise<void> {
    await this.notify(payload.userId, 'doctor.approved', {});
  }

  @OnEvent('doctor.rejected')
  async onDoctorRejected(payload: { userId: string; reason: string }): Promise<void> {
    await this.notify(payload.userId, 'doctor.rejected', { reason: payload.reason });
  }

  @OnEvent('payment.approved')
  async onPaymentApproved(payload: { doctorId?: string; paymentId: string }): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: payload.paymentId },
      include: { doctor: true },
    });
    if (payment) await this.notify(payment.doctor.userId, 'payment.approved', {});
  }

  @OnEvent('payment.rejected')
  async onPaymentRejected(payload: { paymentId: string }): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: payload.paymentId },
      include: { doctor: true },
    });
    if (payment) await this.notify(payment.doctor.userId, 'payment.rejected', {});
  }

  /** SMS nudge when a patient is 2 positions away — they should start travelling. */
  @OnEvent('queue.advanced')
  async onQueueAdvanced(payload: {
    state: { sessionId: string; currentToken: number };
    you: Array<{ patientId: string; you: { yourToken: number; position: number } }>;
  }): Promise<void> {
    const closing = payload.you.filter((target) => target.you.position === 2);
    if (closing.length === 0) return;

    const session = await this.prisma.session.findUnique({
      where: { id: payload.state.sessionId },
      include: { schedule: { include: { dispensary: true } } },
    });
    if (!session) return;

    for (const target of closing) {
      await this.notify(target.patientId, 'queue.almost_your_turn', {
        dispensary: session.schedule.dispensary.name,
        current: payload.state.currentToken,
        token: target.you.yourToken,
      });
    }
  }
}
