import { Injectable } from '@nestjs/common';
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
