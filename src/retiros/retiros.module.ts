import { Module } from '@nestjs/common';
import { RetirosController } from './retiros.controller';
import { RetirosService } from './retiros.service';

@Module({
  controllers: [RetirosController],
  providers: [RetirosService]
})
export class RetirosModule {}
