import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DISTRICT_SLUGS, SPECIALTIES } from '@medqueue/shared';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

class SearchQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(DISTRICT_SLUGS) district?: string;
  @IsOptional() @IsIn(SPECIALTIES as readonly string[]) specialty?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng?: number;
  /** Radius in km for GPS search; default 10. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) radiusKm?: number;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Public, read-only doctor discovery. Only APPROVED doctors are visible. */
@Public()
@Controller('search')
export class DoctorsSearchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get('doctors')
  async search(@Query() query: SearchQuery) {
    const todayStart = new Date(new Date().toISOString().slice(0, 10));

    const dispensaries = await this.prisma.dispensary.findMany({
      where: {
        district: query.district,
        doctor: {
          approvalStatus: 'APPROVED',
          specialty: query.specialty as never,
          user: {
            status: 'ACTIVE',
            deletedAt: null,
            ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
          },
        },
      },
      include: {
        doctor: {
          include: { user: { select: { name: true } } },
        },
        schedules: {
          where: { active: true },
          include: {
            sessions: {
              where: { date: { gte: todayStart }, status: { in: ['SCHEDULED', 'LIVE', 'PAUSED'] } },
              orderBy: { date: 'asc' },
              take: 1,
            },
          },
        },
      },
      take: 100,
    });

    let results = dispensaries.map((d) => {
      const liveSession = d.schedules
        .flatMap((s) => s.sessions)
        .find((s) => s.status === 'LIVE' || s.status === 'PAUSED');
      const nextSession = d.schedules
        .flatMap((s) => s.sessions.map((session) => ({ session, schedule: s })))
        .sort((a, b) => a.session.date.getTime() - b.session.date.getTime())[0];
      return {
        dispensaryId: d.id,
        dispensaryName: d.name,
        town: d.town,
        district: d.district,
        lat: d.lat,
        lng: d.lng,
        doctorId: d.doctor.id,
        doctorName: d.doctor.user.name,
        specialty: d.doctor.specialty,
        consultationFeeLKR: d.doctor.consultationFeeLKR,
        photoKey: d.doctor.photoUrl,
        verified: true,
        live: Boolean(liveSession),
        liveSessionId: liveSession?.id ?? null,
        nextSession: nextSession
          ? {
              id: nextSession.session.id,
              date: nextSession.session.date,
              startTime: nextSession.schedule.startTime,
              status: nextSession.session.status,
            }
          : null,
        distanceKm: null as number | null,
      };
    });

    if (query.lat !== undefined && query.lng !== undefined) {
      const radius = query.radiusKm ?? 10;
      results = results
        .map((r) => ({ ...r, distanceKm: haversineKm(query.lat!, query.lng!, r.lat, r.lng) }))
        .filter((r) => (r.distanceKm ?? Infinity) <= radius)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }

    return Promise.all(
      results.map(async (r) => ({
        ...r,
        distanceKm: r.distanceKm === null ? null : Math.round(r.distanceKm * 10) / 10,
        photoUrl: r.photoKey ? await this.storage.signedUrl(r.photoKey) : null,
        photoKey: undefined,
      })),
    );
  }

  @Get('doctors/:id')
  async detail(@Param('id') id: string) {
    const profile = await this.prisma.doctorProfile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
      include: {
        user: { select: { name: true } },
        dispensaries: { include: { schedules: { where: { active: true } } } },
      },
    });
    if (!profile || profile.approvalStatus !== 'APPROVED') {
      throw new NotFoundException('doctor_not_found');
    }
    return {
      id: profile.id,
      name: profile.user.name,
      specialty: profile.specialty,
      bio: profile.bio,
      consultationFeeLKR: profile.consultationFeeLKR,
      verified: true,
      photoUrl: profile.photoUrl ? await this.storage.signedUrl(profile.photoUrl) : null,
      dispensaries: profile.dispensaries.map((d) => ({
        id: d.id,
        name: d.name,
        addressLine: d.addressLine,
        town: d.town,
        district: d.district,
        lat: d.lat,
        lng: d.lng,
        schedules: d.schedules,
      })),
    };
  }
}
