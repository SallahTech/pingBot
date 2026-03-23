import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { MonitorModule } from './monitor/monitor.module';
import { TelegramModule } from './telegram/telegram.module';
import { AlertsModule } from './alerts/alerts.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),
    AuthModule,
    UsersModule,
    EndpointsModule,
    MonitorModule,
    TelegramModule,
    AlertsModule,
    StripeModule,
  ],
})
export class AppModule {}
