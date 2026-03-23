import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Endpoint } from '../entities/endpoint.entity';

@Injectable()
export class MonitorService implements OnModuleInit {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    @InjectQueue('monitor')
    private readonly monitorQueue: Queue,
    @InjectRepository(Endpoint)
    private readonly endpointsRepository: Repository<Endpoint>,
  ) {}

  async onModuleInit() {
    // On startup, reschedule all active endpoints
    const activeEndpoints = await this.endpointsRepository.find({
      where: { isPaused: false },
    });

    this.logger.log(
      `Scheduling ${activeEndpoints.length} active endpoints on startup`,
    );

    for (const endpoint of activeEndpoints) {
      await this.scheduleJob(endpoint);
    }
  }

  async scheduleJob(endpoint: Endpoint): Promise<void> {
    const jobId = `monitor-${endpoint.id}`;

    // Remove existing job first to avoid duplicates
    await this.removeJob(endpoint.id);

    await this.monitorQueue.add(
      'ping',
      { endpointId: endpoint.id },
      {
        jobId,
        repeat: {
          every: endpoint.checkInterval * 1000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    );

    this.logger.log(
      `Scheduled monitoring for ${endpoint.name} every ${endpoint.checkInterval}s`,
    );
  }

  async removeJob(endpointId: string): Promise<void> {
    const jobId = `monitor-${endpointId}`;

    try {
      const repeatableJobs = await this.monitorQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === jobId) {
          await this.monitorQueue.removeRepeatableByKey(job.key);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to remove job ${jobId}: ${error}`);
    }
  }
}
