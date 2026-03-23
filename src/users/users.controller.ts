import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Request() req: { user: { id: string } }) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) {
      return null;
    }
    const { password, ...result } = user;
    return result;
  }
}
