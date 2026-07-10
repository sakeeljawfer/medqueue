import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsString } from 'class-validator';
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

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly queue: QueueService,
    private readonly sessions: SessionsService,
  ) {}

  /** Doctor's sessions for today (console dashboard). */
  @Roles('DOCTOR')
  @Get('mine/today')
  myToday(@CurrentUser() user: AccessPayload) {
    return this.sessions.todayForDoctor(user.sub);
  }

  @Roles('DOCTOR')
  @Post('start')
  start(@CurrentUser() user: AccessPayload, @Body() dto: StartSessionDto) {
    return this.queue.startSession(user.sub, dto.scheduleId);
  }

  @Roles('DOCTOR')
  @Post(':id/pause')
  pause(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.pauseSession(user.sub, id);
  }

  @Roles('DOCTOR')
  @Post(':id/resume')
  resume(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.resumeSession(user.sub, id);
  }

  @Roles('DOCTOR')
  @Post(':id/end')
  end(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.endSession(user.sub, id);
  }

  @Roles('DOCTOR')
  @Post(':id/next')
  next(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.advance(user.sub, id);
  }

  @Roles('DOCTOR')
  @Post(':id/no-show')
  noShow(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.markNoShow(user.sub, id);
  }

  /** Doctor console: full patient list with statuses. */
  @Roles('DOCTOR')
  @Get(':id/appointments')
  appointments(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.sessions.appointmentsForDoctor(user.sub, id);
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
