import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { PayhereService, type PayhereWebhookBody } from './payhere.service';
import type { PaymentType } from '@prisma/client';

/** Flat subscription pricing (LKR). */
const PRICES: Record<PaymentType, number> = {
  SUBSCRIPTION: 2500, // per month
  LISTING: 1000, // one-off listing fee
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly payhere: PayhereService,
    private readonly events: EventEmitter2,
  ) {}

  private async requireDoctorProfile(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('doctor_profile_not_found');
    return profile;
  }

  /** Create a pending PayHere payment and return the checkout payload. */
  async startPayhere(userId: string, type: PaymentType, idempotencyKey?: string) {
    const profile = await this.requireDoctorProfile(userId);

    if (idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return {
          payment: existing,
          checkout: this.payhere.buildCheckout(
            existing.id,
            Number(existing.amountLKR),
            `MedQueue ${type.toLowerCase()}`,
          ),
        };
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        doctorId: profile.id,
        type,
        amountLKR: PRICES[type],
        method: 'PAYHERE',
        idempotencyKey,
      },
    });
    return {
      payment,
      checkout: this.payhere.buildCheckout(
        payment.id,
        PRICES[type],
        `MedQueue ${type.toLowerCase()}`,
      ),
    };
  }

  /**
   * PayHere server-to-server notification. Signature is verified before any
   * state change; processing is idempotent on payhereRef.
   */
  async handlePayhereWebhook(body: PayhereWebhookBody) {
    if (!this.payhere.verifyWebhookSignature(body)) {
      throw new UnauthorizedException('invalid_payhere_signature');
    }

    const payment = await this.prisma.payment.findUnique({ where: { id: body.order_id } });
    if (!payment) throw new NotFoundException('payment_not_found');
    if (payment.status !== 'PENDING') return { ok: true }; // idempotent replay

    const success = body.status_code === '2';
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: success ? 'APPROVED' : 'REJECTED',
          payhereRef: body.payment_id,
          reviewedAt: new Date(),
        },
      });
      await this.audit.log(
        {
          action: success ? 'payment.approved' : 'payment.rejected',
          entityType: 'Payment',
          entityId: payment.id,
          after: { via: 'payhere_webhook', statusCode: body.status_code },
        },
        tx,
      );
      return row;
    });

    if (success) this.events.emit('payment.approved', { paymentId: payment.id });
    return { ok: true, status: updated.status };
  }

  /** Manual bank-transfer flow: doctor uploads the deposit slip for admin review. */
  async uploadSlip(userId: string, type: PaymentType, slip: Buffer) {
    const profile = await this.requireDoctorProfile(userId);
    const key = await this.storage.putImage('payment-slips', slip);
    return this.prisma.payment.create({
      data: {
        doctorId: profile.id,
        type,
        amountLKR: PRICES[type],
        method: 'BANK_SLIP',
        slipImageUrl: key,
      },
    });
  }

  async myPayments(userId: string) {
    const profile = await this.requireDoctorProfile(userId);
    return this.prisma.payment.findMany({
      where: { doctorId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- admin review ----------

  async pendingSlips() {
    const rows = await this.prisma.payment.findMany({
      where: { status: 'PENDING', method: 'BANK_SLIP' },
      include: {
        doctor: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        slipImageUrl: row.slipImageUrl ? await this.storage.signedUrl(row.slipImageUrl) : null,
      })),
    );
  }

  async review(adminId: string, paymentId: string, approve: boolean, ip?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('payment_not_found');
    if (payment.status !== 'PENDING') throw new BadRequestException('not_pending');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
      });
      await this.audit.log(
        {
          actorId: adminId,
          action: approve ? 'payment.approved' : 'payment.rejected',
          entityType: 'Payment',
          entityId: paymentId,
          before: { status: payment.status },
          after: { status: row.status, via: 'admin_review' },
          ip,
        },
        tx,
      );
      return row;
    });

    this.events.emit(approve ? 'payment.approved' : 'payment.rejected', {
      paymentId,
      doctorId: payment.doctorId,
    });
    return updated;
  }
}
