import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LOCALES, type Locale } from '@medqueue/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth/token.service';
import { UsersService } from './users.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(LOCALES as readonly string[])
  preferredLanguage?: Locale;
}

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AccessPayload) {
    return this.users.getProfile(user.sub);
  }

  @Patch()
  update(@CurrentUser() user: AccessPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  /** PDPA data export: everything we hold about the requesting user. */
  @Get('data')
  exportData(@CurrentUser() user: AccessPayload) {
    return this.users.exportData(user.sub);
  }

  /** Soft delete; a scheduled job purges records 30 days later. */
  @Delete()
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: AccessPayload): Promise<void> {
    await this.users.softDelete(user.sub);
  }
}
