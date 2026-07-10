import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueStateService } from './queue-state.service';
import { QueueGateway } from './queue.gateway';
import { SessionsController } from '../sessions/sessions.controller';
import { SessionsService } from '../sessions/sessions.service';
import { AppointmentsController } from '../appointments/appointments.controller';

@Module({
  controllers: [SessionsController, AppointmentsController],
  providers: [QueueService, QueueStateService, QueueGateway, SessionsService],
  exports: [QueueService, QueueStateService],
})
export class QueueModule {}
