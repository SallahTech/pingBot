import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EndpointsService } from './endpoints.service';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { UsersService } from '../users/users.service';

@Controller('endpoints')
@UseGuards(AuthGuard('jwt'))
export class EndpointsController {
  constructor(
    private readonly endpointsService: EndpointsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateEndpointDto,
    @Request() req: { user: { id: string } },
  ) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) {
      throw new Error('User not found');
    }
    return this.endpointsService.create(dto, user);
  }

  @Get()
  findAll(@Request() req: { user: { id: string } }) {
    return this.endpointsService.findAllByUser(req.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.endpointsService.findOneByUser(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEndpointDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.endpointsService.update(id, req.user.id, dto);
  }

  @Patch(':id/pause')
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.endpointsService.pause(id, req.user.id);
  }

  @Patch(':id/resume')
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.endpointsService.resume(id, req.user.id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.endpointsService.remove(id, req.user.id);
  }
}
