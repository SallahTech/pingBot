import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByTelegramChatId(chatId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telegramChatId: chatId } });
  }

  /**
   * The Telegram chat is the account. Existing users (linked through the old
   * /register or /login flow) are found by their chat ID. New users get an
   * account on first contact. email and password are NOT NULL in the schema,
   * so new accounts get a placeholder email and an unusable random password,
   * which avoids a production migration.
   */
  async findOrCreateByTelegramChatId(chatId: string): Promise<User> {
    const existing = await this.findByTelegramChatId(chatId);
    if (existing) return existing;

    const email = `telegram-${chatId}@users.pingbot`;
    const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    try {
      return await this.create({ email, password, telegramChatId: chatId });
    } catch (error) {
      // Two messages from a new user can race; the email is unique per chat,
      // so the loser of the race just loads the row the winner created.
      const user = await this.findByEmail(email);
      if (user) return user;
      throw error;
    }
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.usersRepository.findOneOrFail({ where: { id } });
  }

  async findByStripeCustomerId(customerId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { stripeCustomerId: customerId },
    });
  }
}
