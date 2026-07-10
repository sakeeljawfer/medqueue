import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * Integration test against a real Postgres (docker compose / CI service).
 * Verifies the core queue invariant: token numbers are unique and gapless
 * under concurrent booking, thanks to SELECT ... FOR UPDATE serialization.
 */
const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)('token issuance under concurrency', () => {
  const prisma = new PrismaClient();
  let sessionId: string;
  const patientIds: string[] = [];

  beforeAll(async () => {
    const doctor = await prisma.user.create({
      data: { phone: `+9477${Date.now() % 10000000}`, role: 'DOCTOR', name: 'Dr Test' },
    });
    const profile = await prisma.doctorProfile.create({
      data: {
        userId: doctor.id,
        slmcRegNo: `${Date.now() % 1000000}`,
        specialty: 'GENERAL_PRACTICE',
        consultationFeeLKR: 1500,
        approvalStatus: 'APPROVED',
      },
    });
    const dispensary = await prisma.dispensary.create({
      data: {
        doctorId: profile.id,
        name: 'Test Dispensary',
        addressLine: '1 Main St',
        town: 'Gampaha',
        district: 'gampaha',
        lat: 7.09,
        lng: 79.99,
      },
    });
    const schedule = await prisma.sessionSchedule.create({
      data: {
        dispensaryId: dispensary.id,
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '21:00',
        maxPatients: 100,
        avgConsultMinutes: 8,
      },
    });
    const session = await prisma.session.create({
      data: { scheduleId: schedule.id, date: new Date('2030-01-07'), status: 'LIVE' },
    });
    sessionId = session.id;

    for (let i = 0; i < 20; i++) {
      const patient = await prisma.user.create({
        data: { phone: `+9471${(Date.now() + i) % 10000000}${i}`.slice(0, 12), name: `P${i}` },
      });
      patientIds.push(patient.id);
    }
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function bookAtomically(patientId: string): Promise<number> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
      const agg = await tx.appointment.aggregate({
        where: { sessionId },
        _max: { tokenNumber: true },
      });
      const tokenNumber = (agg._max.tokenNumber ?? 0) + 1;
      await tx.appointment.create({ data: { sessionId, patientId, tokenNumber } });
      return tokenNumber;
    });
  }

  it('20 parallel bookings produce tokens 1..20 with no duplicates or gaps', async () => {
    const tokens = await Promise.all(patientIds.map((id) => bookAtomically(id)));
    const sorted = [...tokens].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  }, 60_000);
});
