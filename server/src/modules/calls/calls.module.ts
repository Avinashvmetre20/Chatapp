import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PresenceModule } from '../presence/presence.module';
import { ActiveCallStore } from './active-call.store';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';
import { CallsRepository } from './calls.repository';
import { CallsService } from './calls.service';
import { InMemoryActiveCallStore } from './in-memory-active-call.store';

@Module({
  imports: [DatabaseModule, PresenceModule],
  controllers: [CallsController],
  providers: [
    CallsGateway,
    CallsService,
    CallsRepository,
    {
      provide: ActiveCallStore,
      useClass: InMemoryActiveCallStore,
    },
  ],
  exports: [CallsService],
})
export class CallsModule {}
