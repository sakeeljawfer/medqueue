import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { LOCALES, type Locale } from '@medqueue/shared';

export class RequestOtpDto {
  @IsString()
  @Matches(/^(?:\+94|94|0)7[\s\-]?\d{1}[\s\-]?\d{3}[\s\-]?\d{4}$/, {
    message: 'invalid_lk_mobile',
  })
  phone!: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp_must_be_6_digits' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(LOCALES as readonly string[])
  preferredLanguage?: Locale;

  @IsOptional()
  @IsBoolean()
  pdpaConsent?: boolean;
}
