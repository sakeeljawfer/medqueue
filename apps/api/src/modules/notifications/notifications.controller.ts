import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth/token.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AccessPayload) {
    return this.notifications.listForUser(user.sub);
  }

  @Post(':id/read')
  async read(@CurrentUser() user: AccessPayload, @Param('id') id: string) {
    await this.notifications.markRead(user.sub, id);
    return { ok: true };
  }
}
