import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DISTRICT_SLUGS, SPECIALTIES, type Specialty } from '@medqueue/shared';

export class CreateDoctorProfileDto {
  /** SLMC registration numbers are numeric, up to 6 digits, sometimes suffixed. */
  @IsString()
  @Matches(/^[0-9]{1,6}[A-Z]?$/, { message: 'invalid_slmc_reg_no' })
  slmcRegNo!: string;

  @IsIn(SPECIALTIES as readonly string[])
  specialty!: Specialty;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsNumber()
  @Min(0)
  @Max(100_000)
  consultationFeeLKR!: number;
}

export class CreateDispensaryDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(240)
  addressLine!: string;

  @IsString()
  @MaxLength(120)
  town!: string;

  @IsIn(DISTRICT_SLUGS)
  district!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+94|94|0)\d{9}$/, { message: 'invalid_lk_phone' })
  contactPhone?: string;
}

export class CreateScheduleDto {
  @IsString()
  dispensaryId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'invalid_time_hhmm' })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'invalid_time_hhmm' })
  endTime!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  maxPatients!: number;

  @IsInt()
  @Min(1)
  @Max(120)
  avgConsultMinutes!: number;
}
