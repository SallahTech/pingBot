import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Endpoint } from '../entities/endpoint.entity';
import { User } from '../entities/user.entity';
import { Plan } from '../common/enums';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { MonitorService } from '../monitor/monitor.service';

const FREE_ENDPOINT_LIMIT = 3;

@Injectable()
export class EndpointsService {
  private readonly logger = new Logger(EndpointsService.name);

  constructor(
    @InjectRepository(Endpoint)
    private readonly endpointsRepository: Repository<Endpoint>,
    private readonly monitorService: MonitorService,
  ) {}

  async create(dto: CreateEndpointDto, user: User): Promise<Endpoint> {
    if (user.plan === Plan.FREE) {
      const count = await this.endpointsRepository.count({
        where: { userId: user.id },
      });
      if (count >= FREE_ENDPOINT_LIMIT) {
        throw new ForbiddenException(
          'FREE_PLAN_LIMIT',
        );
      }
    }

    const endpoint = this.endpointsRepository.create({
      ...dto,
      userId: user.id,
    });
    const saved = await this.endpointsRepository.save(endpoint);

    await this.monitorService.scheduleJob(saved);
    this.logger.log(`Endpoint created: ${saved.name} (${saved.id})`);

    return saved;
  }

  async countByUser(userId: string): Promise<number> {
    return this.endpointsRepository.count({ where: { userId } });
  }

  async findAllByUser(userId: string): Promise<Endpoint[]> {
    return this.endpointsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneByUser(id: string, userId: string): Promise<Endpoint> {
    const endpoint = await this.endpointsRepository.findOne({
      where: { id, userId },
    });
    if (!endpoint) {
      throw new NotFoundException('Endpoint not found');
    }
    return endpoint;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateEndpointDto,
  ): Promise<Endpoint> {
    const endpoint = await this.findOneByUser(id, userId);

    Object.assign(endpoint, dto);
    const saved = await this.endpointsRepository.save(endpoint);

    // Reschedule if url or interval changed
    if ((dto.url || dto.checkInterval) && !saved.isPaused) {
      await this.monitorService.removeJob(saved.id);
      await this.monitorService.scheduleJob(saved);
    }

    return saved;
  }

  async pause(id: string, userId: string): Promise<Endpoint> {
    const endpoint = await this.findOneByUser(id, userId);
    endpoint.isPaused = true;
    await this.endpointsRepository.save(endpoint);
    await this.monitorService.removeJob(endpoint.id);
    this.logger.log(`Endpoint paused: ${endpoint.name} (${endpoint.id})`);
    return endpoint;
  }

  async resume(id: string, userId: string): Promise<Endpoint> {
    const endpoint = await this.findOneByUser(id, userId);
    endpoint.isPaused = false;
    await this.endpointsRepository.save(endpoint);
    await this.monitorService.scheduleJob(endpoint);
    this.logger.log(`Endpoint resumed: ${endpoint.name} (${endpoint.id})`);
    return endpoint;
  }

  async remove(id: string, userId: string): Promise<void> {
    const endpoint = await this.findOneByUser(id, userId);
    await this.monitorService.removeJob(endpoint.id);
    await this.endpointsRepository.remove(endpoint);
    this.logger.log(`Endpoint deleted: ${endpoint.name} (${id})`);
  }
}
