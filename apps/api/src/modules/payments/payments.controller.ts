import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth/token.service';
import { MAX_UPLOAD_BYTES } from '../../infra/storage/storage.service';
import { PaymentsService } from './payments.service';
import type { PayhereWebhookBody } from './payhere.service';

class StartPaymentDto {
  @IsIn(['SUBSCRIPTION', 'LISTING'])
  type!: 'SUBSCRIPTION' | 'LISTING';
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Roles('DOCTOR')
  @Post('payhere/checkout')
  startPayhere(
    @CurrentUser() user: AccessPayload,
    @Body() dto: StartPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payments.startPayhere(user.sub, dto.type, idempotencyKey);
  }

  /** PayHere server-to-server notify URL — authenticated by MD5 signature. */
  @Public()
  @Post('payhere/webhook')
  @HttpCode(200)
  webhook(@Body() body: PayhereWebhookBody) {
    return this.payments.handlePayhereWebhook(body);
  }

  @Roles('DOCTOR')
  @Post('slip')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadSlip(
    @CurrentUser() user: AccessPayload,
    @Body() dto: StartPaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file_required');
    return this.payments.uploadSlip(user.sub, dto.type, file.buffer);
  }

  @Roles('DOCTOR')
  @Get('mine')
  mine(@CurrentUser() user: AccessPayload) {
    return this.payments.myPayments(user.sub);
  }

  @Roles('ADMIN')
  @Get('pending')
  pending() {
    return this.payments.pendingSlips();
  }

  @Roles('ADMIN')
  @Post(':id/approve')
  approve(@CurrentUser() user: AccessPayload, @Param('id') id: string, @Ip() ip: string) {
    return this.payments.review(user.sub, id, true, ip);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  reject(@CurrentUser() user: AccessPayload, @Param('id') id: string, @Ip() ip: string) {
    return this.payments.review(user.sub, id, false, ip);
  }
}
