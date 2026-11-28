import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { TelegramService } from './telegram.service';
import { UsersService } from '../users/users.service';
import { Plan } from '../common/enums';
import {
  EndpointsService,
  FREE_ENDPOINT_LIMIT,
} from '../endpoints/endpoints.service';

@Injectable()
export class TelegramBot implements OnModuleInit {
  private readonly logger = new Logger(TelegramBot.name);
  private bot: Bot;

  constructor(
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly usersService: UsersService,
    private readonly endpointsService: EndpointsService,
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    this.bot = new Bot(token);
  }

  async onModuleInit() {
    this.telegramService.setBot(this.bot);
    this.registerHandlers();

    await this.bot.api.setMyCommands([
      { command: 'add', description: 'Monitor an endpoint: /add <url> <name>' },
      {
        command: 'status',
        description: 'List your endpoints and their status',
      },
      {
        command: 'update',
        description: 'Change an endpoint: /update <id> <url> <name>',
      },
      { command: 'pause', description: 'Pause monitoring: /pause <id>' },
      { command: 'resume', description: 'Resume monitoring: /resume <id>' },
      { command: 'remove', description: 'Delete an endpoint: /remove <id>' },
      { command: 'help', description: 'Show all commands' },
    ]);

    this.bot.start({
      onStart: () => this.logger.log('Telegram bot started'),
    });
  }

  private registerHandlers() {
    this.bot.command('start', async (ctx) => {
      await this.usersService.findOrCreateByTelegramChatId(
        ctx.chat.id.toString(),
      );
      await ctx.reply(
        '👋 Welcome to PingBot!\n\n' +
          'I check your endpoints every 60 seconds and message you here when one goes down, and again when it recovers.\n\n' +
          'Your Telegram account is your PingBot account, so there is nothing to sign up for.\n\n' +
          `Add your first endpoint (up to ${FREE_ENDPOINT_LIMIT}):\n` +
          '/add https://api.example.com/health My API\n\n' +
          'Type /help to see all commands.',
      );
    });

    // Accounts used to need /register or /login with a password typed into the
    // chat. Keep the commands so old habits get a clear answer, and delete the
    // message so a password doesn't sit in the chat history.
    const noLoginNeeded = async (ctx: Context) => {
      if (!ctx.chat || !ctx.message) return;
      if (ctx.match) {
        try {
          await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
        } catch {
          // Not fatal: the bot may lack permission to delete in group chats.
        }
      }
      await this.usersService.findOrCreateByTelegramChatId(
        ctx.chat.id.toString(),
      );
      await ctx.reply(
        'No login needed any more: your Telegram account is your PingBot account.' +
          (ctx.match
            ? ' I deleted your message so the password is not kept in the chat.'
            : '') +
          '\n\nType /status to see your endpoints or /add <url> <name> to add one.',
      );
    };
    this.bot.command('register', noLoginNeeded);
    this.bot.command('login', noLoginNeeded);

    this.bot.command('status', async (ctx) => {
      const user = await this.getUser(ctx);
      if (!user) return;

      const endpoints = await this.endpointsService.findAllByUser(user.id);

      if (endpoints.length === 0) {
        await ctx.reply(
          'No endpoints configured yet. Use /add <url> <name> to add one.',
        );
        return;
      }

      const lines = endpoints.map((ep) => {
        const emoji = this.telegramService.getStatusEmoji(ep.lastStatus);
        const paused = ep.isPaused ? ' (paused)' : '';
        return `${emoji} ${ep.name}${paused}\n   ${ep.url}\n   ID: ${ep.id}\n   Uptime: ${ep.uptimePercent.toFixed(1)}%`;
      });

      await ctx.reply(`📊 Your Endpoints:\n\n${lines.join('\n\n')}`);
    });

    this.bot.command('add', async (ctx) => {
      const user = await this.getUser(ctx);
      if (!user) return;

      const args = ctx.match?.trim().split(/\s+/);
      if (!args || args.length < 2) {
        await ctx.reply(
          'Usage: /add <url> <name>\nExample: /add https://api.example.com My API',
        );
        return;
      }

      const url = args[0];
      const name = args.slice(1).join(' ');

      try {
        const endpoint = await this.endpointsService.create(
          { url, name },
          user,
        );

        let reply = `✅ Endpoint added!\n\nName: ${endpoint.name}\nURL: ${endpoint.url}\nID: ${endpoint.id}\n\nMonitoring every 60 seconds.`;

        if (user.plan === Plan.FREE) {
          const count = await this.endpointsService.countByUser(user.id);
          if (count >= FREE_ENDPOINT_LIMIT) {
            reply += `\n\nThat's ${count}/${FREE_ENDPOINT_LIMIT} endpoints, the most one account can monitor.`;
          }
        }

        await ctx.reply(reply);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('FREE_PLAN_LIMIT')
        ) {
          await ctx.reply(
            `❌ You're already monitoring ${FREE_ENDPOINT_LIMIT} endpoints, the most one account can have.\n\n` +
              'Remove one with /remove <id> to add another. /status shows the IDs.',
          );
        } else {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          await ctx.reply(`❌ ${message}`);
        }
      }
    });

    this.bot.command('update', async (ctx) => {
      const user = await this.getUser(ctx);
      if (!user) return;

      const args = ctx.match?.trim().split(/\s+/);
      if (!args || args.length < 3) {
        await ctx.reply(
          'Usage: /update <id> <url> <name>\nExample: /update abc123 https://api.myapp.com My API',
        );
        return;
      }

      const endpointId = args[0];
      const url = args[1];
      const name = args.slice(2).join(' ');

      try {
        const endpoint = await this.endpointsService.update(
          endpointId,
          user.id,
          { url, name },
        );
        await ctx.reply(
          `✅ Endpoint updated!\n\nName: ${endpoint.name}\nURL: ${endpoint.url}\nStatus: will re-check within 60s`,
        );
      } catch {
        await ctx.reply(
          '❌ Endpoint not found. Use /status to see your endpoint IDs.',
        );
      }
    });

    this.bot.command('pause', async (ctx) => {
      const user = await this.getUser(ctx);
      if (!user) return;

      const endpointId = ctx.match?.trim();
      if (!endpointId) {
        await ctx.reply('Usage: /pause <endpoint-id>');
        return;
      }

      try {
        const endpoint = await this.endpointsService.pause(endpointId, user.id);
        await ctx.reply(`⏸ Monitoring paused for ${endpoint.name}`);
      } catch {
        await ctx.reply('❌ Endpoint not found or access denied.');
      }
    });

    this.bot.command('resume', async (ctx) => {
      const user = await this.getUser(ctx);
      if (!user) return;

      const endpointId = ctx.match?.trim();
      if (!endpointId) {
        await ctx.reply('Usage: /resume <endpoint-id>');
        return;
      }

      try {
        const endpoint = await this.endpointsService.resume(
          endpointId,
          user.id,
        );
        await ctx.reply(`▶️ Monitoring resumed for ${endpoint.name}`);
      } catch {
        await ctx.reply('❌ Endpoint not found or access denied.');
      }
    });

    this.bot.command('remove', async (ctx) => {
      const user = await this.getUser(ctx);
      if (!user) return;

      const endpointId = ctx.match?.trim();
      if (!endpointId) {
        await ctx.reply('Usage: /remove <endpoint-id>');
        return;
      }

      try {
        await this.endpointsService.remove(endpointId, user.id);
        await ctx.reply('🗑 Endpoint removed.');
      } catch {
        await ctx.reply('❌ Endpoint not found or access denied.');
      }
    });

    this.bot.command('upgrade', async (ctx) => {
      await ctx.reply(
        `PingBot is free. Each account can monitor up to ${FREE_ENDPOINT_LIMIT} endpoints.`,
      );
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '📡 PingBot commands\n\n' +
          '/add <url> <name> - Monitor an endpoint\n' +
          '/status - List your endpoints and their status\n' +
          '/update <id> <url> <name> - Change an endpoint\n' +
          '/pause <id> - Pause monitoring\n' +
          '/resume <id> - Resume monitoring\n' +
          '/remove <id> - Delete an endpoint\n\n' +
          `Up to ${FREE_ENDPOINT_LIMIT} endpoints per account. Use /status to get endpoint IDs.`,
      );
    });

    this.bot.catch((err) => {
      this.logger.error(`Bot error: ${err.message}`);
    });
  }

  private async getUser(ctx: Context) {
    if (!ctx.chat) return null;
    return this.usersService.findOrCreateByTelegramChatId(
      ctx.chat.id.toString(),
    );
  }
}
