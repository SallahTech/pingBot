import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Endpoint } from '../entities/endpoint.entity';
import { MonitorService } from './monitor.service';
import { MonitorProcessor } from './monitor.processor';
import { TelegramModule } from '../telegram/telegram.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Endpoint]),
    BullModule.registerQueue({ name: 'monitor' }),
    forwardRef(() => TelegramModule),
    AlertsModule,
  ],
  providers: [MonitorService, MonitorProcessor],
  exports: [MonitorService],
})
export class MonitorModule {}
