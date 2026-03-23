import {
  Controller,
  Get,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(AuthGuard('jwt'))
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    return this.alertsService.findByUser(
      req.user.id,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
