import { Injectable, Logger } from '@nestjs/common';
import { AlertType, CheckStatus } from '../common/enums';
import { Endpoint } from '../entities/endpoint.entity';
import { Bot } from 'grammy';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;

  constructor(private readonly config: ConfigService) {}

  setBot(bot: Bot) {
    this.bot = bot;
  }

  async sendAlert(
    chatId: string,
    endpoint: Endpoint,
    alertType: AlertType,
    errorMessage: string,
  ): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized, skipping alert');
      return;
    }

    let message: string;
    const url = endpoint.url.replace(/^https?:\/\//, '');

    if (alertType === AlertType.DOWN) {
      const now = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      });
      message = [
        `🔴 ${endpoint.name} is DOWN`,
        `URL: ${url}`,
        `Down since: ${now} UTC`,
        `Response: ${errorMessage || 'No response'}`,
        `Last 24h uptime: ${endpoint.uptimePercent.toFixed(1)}%`,
        '',
        `Tap /pause ${endpoint.id} to silence`,
      ].join('\n');
    } else if (alertType === AlertType.RECOVERED) {
      message = [
        `🟢 ${endpoint.name} is back UP`,
        `URL: ${url}`,
      ].join('\n');
    } else {
      message = [
        `🟡 ${endpoint.name} is SLOW`,
        `URL: ${url}`,
        `Last 24h uptime: ${endpoint.uptimePercent.toFixed(1)}%`,
      ].join('\n');
    }

    try {
      await this.bot.api.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error(`Failed to send Telegram alert: ${error}`);
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.api.sendMessage(chatId, text);
    } catch (error) {
      this.logger.error(`Failed to send Telegram message: ${error}`);
    }
  }

  getStatusEmoji(status: CheckStatus): string {
    switch (status) {
      case CheckStatus.UP:
        return '🟢';
      case CheckStatus.DOWN:
        return '🔴';
      case CheckStatus.SLOW:
        return '🟡';
      default:
        return '⚪';
    }
  }
}
