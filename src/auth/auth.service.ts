import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // In-memory store for telegram link tokens (token -> userId, with TTL)
  private readonly telegramTokens = new Map<
    string,
    { userId: string; expiresAt: number }
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      email,
      password: hashedPassword,
    });

    this.logger.log(`User registered: ${user.email}`);

    return {
      access_token: this.generateToken(user.id, user.email),
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      access_token: this.generateToken(user.id, user.email),
    };
  }

  generateTelegramToken(userId: string): string {
    const token = uuidv4().slice(0, 8);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.telegramTokens.set(token, { userId, expiresAt });

    // Cleanup expired tokens
    this.cleanupExpiredTokens();

    return token;
  }

  validateTelegramToken(token: string): string | null {
    const entry = this.telegramTokens.get(token);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.telegramTokens.delete(token);
      return null;
    }

    this.telegramTokens.delete(token);
    return entry.userId;
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }

  private cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, entry] of this.telegramTokens.entries()) {
      if (now > entry.expiresAt) {
        this.telegramTokens.delete(token);
      }
    }
  }
}
