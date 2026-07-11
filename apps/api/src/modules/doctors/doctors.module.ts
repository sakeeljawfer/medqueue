import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { DoctorsSearchController } from './doctors-search.controller';
import { DoctorsService } from './doctors.service';

@Module({
  controllers: [DoctorsController, DoctorsSearchController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
