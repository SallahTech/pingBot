import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Endpoint } from '../entities/endpoint.entity';
import { CheckStatus, AlertType } from '../common/enums';
import { TelegramService } from '../telegram/telegram.service';
import { AlertsService } from '../alerts/alerts.service';

interface PingJobData {
  endpointId: string;
}

@Processor('monitor')
export class MonitorProcessor extends WorkerHost {
  private readonly logger = new Logger(MonitorProcessor.name);

  constructor(
    @InjectRepository(Endpoint)
    private readonly endpointsRepository: Repository<Endpoint>,
    private readonly telegramService: TelegramService,
    private readonly alertsService: AlertsService,
  ) {
    super();
  }

  async process(job: Job<PingJobData>): Promise<void> {
    const { endpointId } = job.data;

    const endpoint = await this.endpointsRepository.findOne({
      where: { id: endpointId },
      relations: ['user'],
    });

    if (!endpoint || endpoint.isPaused) {
      return;
    }

    const previousStatus = endpoint.lastStatus;
    let newStatus: CheckStatus;
    let responseTime = 0;
    let errorMessage = '';

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint.url, {
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);
      responseTime = Date.now() - startTime;

      if (response.status >= 200 && response.status < 400) {
        newStatus = responseTime > 2000 ? CheckStatus.SLOW : CheckStatus.UP;
      } else {
        newStatus = CheckStatus.DOWN;
        errorMessage = `HTTP ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      newStatus = CheckStatus.DOWN;
      if (error instanceof Error) {
        errorMessage =
          error.name === 'AbortError' ? 'Connection timeout' : error.message;
      } else {
        errorMessage = 'Unknown error';
      }
    }

    // Update endpoint status
    await this.endpointsRepository.update(endpoint.id, {
      lastCheckedAt: new Date(),
      lastStatus: newStatus,
      uptimePercent: this.calculateUptime(endpoint.uptimePercent, newStatus),
    });

    // Alert on status CHANGE (including first check from UNKNOWN)
    if (previousStatus !== newStatus) {
      await this.handleStatusChange(
        endpoint,
        previousStatus,
        newStatus,
        errorMessage,
        responseTime,
      );
    }

    this.logger.debug(
      `Pinged ${endpoint.name}: ${newStatus} (${responseTime}ms) [prev=${previousStatus}, chatId=${endpoint.user.telegramChatId ?? 'none'}]`,
    );
  }

  private async handleStatusChange(
    endpoint: Endpoint,
    previousStatus: CheckStatus,
    newStatus: CheckStatus,
    errorMessage: string,
    responseTime: number,
  ): Promise<void> {
    let alertType: AlertType;
    let message: string;

    if (newStatus === CheckStatus.DOWN) {
      alertType = AlertType.DOWN;
      message = `${endpoint.name} is DOWN. ${errorMessage}`;
    } else if (
      newStatus === CheckStatus.UP &&
      previousStatus === CheckStatus.DOWN
    ) {
      alertType = AlertType.RECOVERED;
      message = `${endpoint.name} is back UP.`;
    } else if (newStatus === CheckStatus.SLOW) {
      alertType = AlertType.SLOW;
      message = `${endpoint.name} is SLOW (${responseTime}ms).`;
    } else {
      return;
    }

    // Save alert to DB
    await this.alertsService.create({
      endpointId: endpoint.id,
      userId: endpoint.userId,
      type: alertType,
      message,
    });

    // Send Telegram notification if user has linked their chat
    if (endpoint.user.telegramChatId) {
      await this.telegramService.sendAlert(
        endpoint.user.telegramChatId,
        endpoint,
        alertType,
        errorMessage,
      );
    }

    this.logger.log(
      `Alert: ${endpoint.name} changed from ${previousStatus} to ${newStatus}`,
    );
  }

  private calculateUptime(
    currentUptime: number,
    newStatus: CheckStatus,
  ): number {
    // Simple exponential moving average
    const weight = 0.01;
    const isUp = newStatus === CheckStatus.UP || newStatus === CheckStatus.SLOW;
    const newValue = isUp ? 100 : 0;
    return currentUptime * (1 - weight) + newValue * weight;
  }
}
