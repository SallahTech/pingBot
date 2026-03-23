import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('telegram-token')
  @UseGuards(AuthGuard('jwt'))
  generateTelegramToken(@Request() req: { user: { id: string } }) {
    const token = this.authService.generateTelegramToken(req.user.id);
    return { token, expiresIn: '10 minutes' };
  }
}
