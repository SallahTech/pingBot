import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { AlertType } from '../common/enums';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertsRepository: Repository<Alert>,
  ) {}

  async create(data: {
    endpointId: string;
    userId: string;
    type: AlertType;
    message: string;
  }): Promise<Alert> {
    const alert = this.alertsRepository.create(data);
    return this.alertsRepository.save(alert);
  }

  async findByUser(userId: string, limit = 20): Promise<Alert[]> {
    return this.alertsRepository.find({
      where: { userId },
      relations: ['endpoint'],
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  async findByEndpoint(endpointId: string, limit = 20): Promise<Alert[]> {
    return this.alertsRepository.find({
      where: { endpointId },
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }
}
