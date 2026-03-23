import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { TelegramService } from './telegram.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { EndpointsService } from '../endpoints/endpoints.service';

@Injectable()
export class TelegramBot implements OnModuleInit {
  private readonly logger = new Logger(TelegramBot.name);
  private bot: Bot;

  constructor(
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly authService: AuthService,
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
      { command: 'register', description: 'Create a new account' },
      { command: 'login', description: 'Login to your existing account' },
      { command: 'status', description: 'View all endpoints and their status' },
      { command: 'add', description: 'Add a new endpoint — /add <url> <name>' },
      { command: 'update', description: 'Update an endpoint — /update <id> <url> <name>' },
      { command: 'pause', description: 'Pause monitoring — /pause <id>' },
      { command: 'resume', description: 'Resume monitoring — /resume <id>' },
      { command: 'remove', description: 'Delete an endpoint — /remove <id>' },
      { command: 'upgrade', description: 'Upgrade to Pro plan' },
      { command: 'help', description: 'Show all available commands' },
    ]);

    this.bot.start({
      onStart: () => this.logger.log('Telegram bot started'),
    });
  }

  private registerHandlers() {
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 Welcome to PingBot!\n\n' +
          'I monitor your API endpoints and alert you instantly when they go down.\n\n' +
          'Get started:\n' +
          '/register <email> <password> — Create an account\n' +
          '/login <email> <password> — Login to existing account\n\n' +
          'Type /help to see all commands.',
      );
    });

    this.bot.command('register', async (ctx) => {
      const args = ctx.match?.trim().split(/\s+/);
      if (!args || args.length < 2) {
        await ctx.reply('Usage: /register <email> <password>\nExample: /register user@example.com mypassword');
        return;
      }

      const [email, password] = args;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await ctx.reply('❌ Invalid email format.');
        return;
      }

      if (password.length < 6) {
        await ctx.reply('❌ Password must be at least 6 characters.');
        return;
      }

      try {
        await this.authService.register(email, password);
        const user = await this.usersService.findByEmail(email);
        if (user) {
          await this.usersService.update(user.id, {
            telegramChatId: ctx.chat.id.toString(),
          });
        }

        await ctx.reply(
          `✅ Account created and linked!\nWelcome to PingBot, ${email} 🎉\n\n` +
            'You\'re on the FREE plan (3 endpoints max).\n' +
            'Type /add <url> <name> to start monitoring your first API.',
        );
        this.logger.log(`User registered via Telegram: ${email}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already registered')) {
          await ctx.reply('❌ That email is already registered. Use /login <email> <password> instead.');
        } else {
          await ctx.reply('❌ Registration failed. Please try again.');
          this.logger.error(`Registration error: ${error}`);
        }
      }
    });

    this.bot.command('login', async (ctx) => {
      const args = ctx.match?.trim().split(/\s+/);
      if (!args || args.length < 2) {
        await ctx.reply('Usage: /login <email> <password>\nExample: /login user@example.com mypassword');
        return;
      }

      const [email, password] = args;

      try {
        await this.authService.login(email, password);
        const user = await this.usersService.findByEmail(email);
        if (user) {
          await this.usersService.update(user.id, {
            telegramChatId: ctx.chat.id.toString(),
          });
        }

        await ctx.reply(
          '✅ Logged in successfully!\nWelcome back 👋\n\n' +
            'Type /status to see your endpoints.',
        );
        this.logger.log(`User logged in via Telegram: ${email}`);
      } catch {
        await ctx.reply('❌ Invalid email or password.');
      }
    });

    this.bot.command('status', async (ctx) => {
      const user = await this.getUser(ctx);
      if (!user) return;

      const endpoints = await this.endpointsService.findAllByUser(user.id);

      if (endpoints.length === 0) {
        await ctx.reply('No endpoints configured yet. Use /add <url> <name> to add one.');
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
        await ctx.reply('Usage: /add <url> <name>\nExample: /add https://api.example.com My API');
        return;
      }

      const url = args[0];
      const name = args.slice(1).join(' ');

      try {
        const endpoint = await this.endpointsService.create(
          { url, name },
          user,
        );

        let reply =
          `✅ Endpoint added!\n\nName: ${endpoint.name}\nURL: ${endpoint.url}\nID: ${endpoint.id}\n\nMonitoring every 60 seconds.`;

        if (user.plan === 'FREE') {
          const count = await this.endpointsService.countByUser(user.id);
          if (count === 2) {
            reply += '\n\n💡 _You\'re using 2/3 free endpoints. Type /upgrade to get unlimited._';
          } else if (count >= 3) {
            reply += '\n\n⚠️ _You\'ve reached the free plan limit. Type /upgrade to add more._';
          }
        }

        await ctx.reply(reply, { parse_mode: 'Markdown' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('FREE_PLAN_LIMIT')) {
          await ctx.reply(
            '❌ *Free plan limit reached* (3/3 endpoints)\n\n' +
              'You\'ve used all your free endpoints.\n' +
              'Upgrade to Pro for unlimited monitoring 👇\n\n' +
              'Type /upgrade to get started — first 7 days free!',
            { parse_mode: 'Markdown' },
          );
        } else {
          const message = error instanceof Error ? error.message : 'Unknown error';
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
        await ctx.reply('❌ Endpoint not found. Use /status to see your endpoint IDs.');
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
        const endpoint = await this.endpointsService.resume(endpointId, user.id);
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
      const chatId = ctx.chat.id.toString();
      const user = await this.usersService.findByTelegramChatId(chatId);

      if (!user) {
        await ctx.reply(
          '❌ You need to register first.\nType /register your@email.com yourpassword to create an account.',
        );
        return;
      }

      if (user.plan === 'PRO') {
        await ctx.reply(
          '✅ You\'re already on PingBot Pro!\n\n' +
            'You have unlimited endpoint monitoring. 🚀\n' +
            'Type /status to view your endpoints.',
        );
        return;
      }

      const paymentLink = this.config.getOrThrow<string>('STRIPE_PAYMENT_LINK_URL');
      await ctx.reply(
        '🚀 *Upgrade to PingBot Pro*\n\n' +
          'You\'re currently on the *Free plan* (3 endpoints max).\n\n' +
          '*Pro plan — $5/month includes:*\n' +
          '✓ Unlimited endpoints\n' +
          '✓ Instant Telegram alerts\n' +
          '✓ 7-day free trial — no charge today\n' +
          '✓ Cancel anytime\n\n' +
          `👉 [Click here to upgrade](${paymentLink})\n\n` +
          '_After payment, your account upgrades automatically within 1 minute. No action needed._',
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '📡 *PingBot Commands*\n\n' +
          '👤 *Account*\n' +
          '/register <email> <password> — Create account\n' +
          '/login <email> <password> — Login to existing account\n\n' +
          '📊 *Monitoring*\n' +
          '/status — View all endpoints with live status\n' +
          '/add <url> <name> — Add endpoint to monitor\n' +
          '/update <id> <url> <name> — Update an endpoint\n' +
          '/pause <id> — Pause monitoring\n' +
          '/resume <id> — Resume monitoring\n' +
          '/remove <id> — Delete endpoint\n\n' +
          '💳 *Billing*\n' +
          '/upgrade — Upgrade to Pro ($5/month, 7-day free trial)\n\n' +
          '_Use /status to get your endpoint IDs._',
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.catch((err) => {
      this.logger.error(`Bot error: ${err.message}`);
    });
  }

  private async getUser(ctx: { chat: { id: number }; reply: (text: string) => Promise<unknown> }) {
    const chatId = ctx.chat.id.toString();
    const user = await this.usersService.findByTelegramChatId(chatId);
    if (!user) {
      await ctx.reply('❌ Account not linked. Use /register or /login first.');
    }
    return user;
  }
}
