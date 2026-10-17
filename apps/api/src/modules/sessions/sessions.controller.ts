import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AccessPayload } from '../auth/token.service';
import { QueueService } from '../queue/queue.service';
import { SessionsService } from './sessions.service';

class StartSessionDto {
  @IsString()
  scheduleId!: string;
}

class CreateSessionDto {
  @IsOptional()
  @IsString()
  dispensaryId?: string;

  @IsOptional()
  @IsString()
  dispensaryName?: string;

  @IsOptional()
  @IsString()
  town?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  maxPatients?: number;

  @IsOptional()
  @IsNumber()
  avgConsultMinutes?: number;

  @IsOptional()
  @IsBoolean()
  autoStart?: boolean;
}

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly queue: QueueService,
    private readonly sessions: SessionsService,
  ) {}

  /** Doctor's sessions for today (console dashboard). */
  @Roles('DOCTOR', 'ADMIN')
  @Get('mine/today')
  myToday(@CurrentUser() user: AccessPayload) {
    return this.sessions.todayForDoctor(user.sub, user.role);
  }

  /** Doctor's dispensaries. */
  @Roles('DOCTOR', 'ADMIN')
  @Get('mine/dispensaries')
  myDispensaries(@CurrentUser() user: AccessPayload) {
    return this.sessions.dispensariesForDoctor(user.sub, user.role);
  }

  /** Create a session (and optionally auto-start it immediately). */
  @Roles('DOCTOR', 'ADMIN')
  @Post('create')
  async createSession(
    @CurrentUser() user: AccessPayload,
    @Body() dto: CreateSessionDto,
  ) {
    const { session, scheduleId } = await this.sessions.createSession(user.sub, dto, user.role);
    if (dto.autoStart) {
      return this.queue.startSession(user.sub, scheduleId, user.role);
    }
    return session;
  }

  @Roles('DOCTOR', 'ADMIN')
  @Post('start')
  start(@CurrentUser() user: AccessPayload, @Body() dto: StartSessionDto) {
    return this.queue.startSession(user.sub, dto.scheduleId, user.role);
  }

  @Roles('DOCTOR', 'ADMIN')
  @Post(':id/pause')
  pause(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.pauseSession(user.sub, id, user.role);
  }

  @Roles('DOCTOR', 'ADMIN')
  @Post(':id/resume')
  resume(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.resumeSession(user.sub, id, user.role);
  }

  @Roles('DOCTOR', 'ADMIN')
  @Post(':id/end')
  end(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.endSession(user.sub, id, user.role);
  }

  @Roles('DOCTOR', 'ADMIN')
  @Post(':id/next')
  next(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.advance(user.sub, id, user.role);
  }

  @Roles('DOCTOR', 'ADMIN')
  @Post(':id/no-show')
  noShow(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.markNoShow(user.sub, id, user.role);
  }

  /** Doctor console: full patient list with statuses. */
  @Roles('DOCTOR', 'ADMIN')
  @Get(':id/appointments')
  appointments(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.sessions.appointmentsForDoctor(user.sub, id, user.role);
  }

  /** Public session detail (for the patient-facing screens). */
  @Public()
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.sessions.publicDetail(id);
  }

  /** Upcoming/live sessions for a dispensary or doctor. */
  @Public()
  @Get()
  list(@Query('doctorId') doctorId?: string, @Query('dispensaryId') dispensaryId?: string) {
    return this.sessions.listPublic({ doctorId, dispensaryId });
  }
}
