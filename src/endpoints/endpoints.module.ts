import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Endpoint } from '../entities/endpoint.entity';
import { EndpointsService } from './endpoints.service';
import { EndpointsController } from './endpoints.controller';
import { MonitorModule } from '../monitor/monitor.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Endpoint]), MonitorModule, UsersModule],
  controllers: [EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}
