import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth/token.service';
import { QueueService } from '../queue/queue.service';

@Roles('PATIENT', 'ADMIN', 'DOCTOR')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly queue: QueueService) {}

  @Get()
  mine(@CurrentUser() user: AccessPayload) {
    return this.queue.myAppointments(user.sub);
  }

  @Post('sessions/:sessionId/book')
  book(@CurrentUser() user: AccessPayload, @Param('sessionId') sessionId: string) {
    return this.queue.book(user.sub, sessionId);
  }

  @Post('sessions/:sessionId/rejoin')
  rejoin(@CurrentUser() user: AccessPayload, @Param('sessionId') sessionId: string) {
    return this.queue.rejoin(user.sub, sessionId);
  }

  @Get('sessions/:sessionId/ticket')
  ticket(@CurrentUser() user: AccessPayload, @Param('sessionId') sessionId: string) {
    return this.queue.ticketFor(user.sub, sessionId);
  }

  @Delete(':id')
  cancel(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    return this.queue.cancelBooking(user.sub, id);
  }
}
