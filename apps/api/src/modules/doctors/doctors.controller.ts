import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth/token.service';
import { MAX_UPLOAD_BYTES } from '../../infra/storage/storage.service';
import { DoctorsService } from './doctors.service';
import {
  CreateDispensaryDto,
  CreateDoctorProfileDto,
  CreateScheduleDto,
} from './dto/doctors.dto';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  /** Any authenticated user may begin doctor onboarding. */
  @Post('profile')
  createProfile(@CurrentUser() user: AccessPayload, @Body() dto: CreateDoctorProfileDto) {
    return this.doctors.createProfile(user.sub, dto);
  }

  @Roles('DOCTOR')
  @Get('me')
  me(@CurrentUser() user: AccessPayload) {
    return this.doctors.getOwnProfile(user.sub);
  }

  @Roles('DOCTOR')
  @Post('photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadPhoto(@CurrentUser() user: AccessPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file_required');
    return this.doctors.setPhoto(user.sub, file.buffer);
  }

  @Roles('DOCTOR')
  @Post('dispensaries')
  addDispensary(@CurrentUser() user: AccessPayload, @Body() dto: CreateDispensaryDto) {
    return this.doctors.addDispensary(user.sub, dto);
  }

  @Roles('DOCTOR')
  @Post('schedules')
  addSchedule(@CurrentUser() user: AccessPayload, @Body() dto: CreateScheduleDto) {
    return this.doctors.addSchedule(user.sub, dto);
  }
}
