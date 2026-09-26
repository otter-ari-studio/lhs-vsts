import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MachinesModule } from './machines/machines.module.js';
import { ScoresModule } from './scores/scores.module.js';

@Module({
  imports: [MachinesModule, ScoresModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
