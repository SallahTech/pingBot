import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramBot } from './telegram.bot';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { EndpointsModule } from '../endpoints/endpoints.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    forwardRef(() => EndpointsModule),
  ],
  providers: [TelegramService, TelegramBot],
  exports: [TelegramService],
})
export class TelegramModule {}
