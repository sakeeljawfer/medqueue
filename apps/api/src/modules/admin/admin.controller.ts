import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth/token.service';
import { AdminService } from './admin.service';

class RejectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class SetStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
}

class ListUsersQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(['PATIENT', 'DOCTOR', 'ADMIN']) role?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED']) status?: string;
}

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('doctors/pending')
  pendingDoctors() {
    return this.admin.pendingDoctors();
  }

  @Post('doctors/:id/approve')
  approve(@CurrentUser() user: AccessPayload, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.approveDoctor(user.sub, id, ip);
  }

  @Post('doctors/:id/reject')
  reject(
    @CurrentUser() user: AccessPayload,
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @Ip() ip: string,
  ) {
    return this.admin.rejectDoctor(user.sub, id, dto.reason, ip);
  }

  @Get('users')
  users(@Query() query: ListUsersQuery) {
    return this.admin.listUsers(query);
  }

  @Post('users/:id/status')
  setStatus(
    @CurrentUser() user: AccessPayload,
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
    @Ip() ip: string,
  ) {
    return this.admin.setUserStatus(user.sub, id, dto.status, ip);
  }

  @Get('audit-logs')
  auditLogs(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.admin.auditLogs({ entityType, entityId, cursor });
  }
}
