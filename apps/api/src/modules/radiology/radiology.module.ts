import { Module } from '@nestjs/common'
import { RadiologyController } from './radiology.controller'
import { RadiologyService } from './radiology.service'

@Module({
  controllers: [RadiologyController],
  providers: [RadiologyService],
  exports: [RadiologyService],
})
export class RadiologyModule {}
