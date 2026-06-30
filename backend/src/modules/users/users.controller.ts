import {
  Controller, Get, Patch, Post, Delete, Body, Param,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: User, @Body() body: Partial<User>) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Post('me/addresses')
  addAddress(@CurrentUser() user: User, @Body() body: any) {
    return this.usersService.addAddress(user.id, body);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
  ) {
    return this.usersService.updateAddress(user.id, id, body);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deleteAddress(user.id, id);
  }
}
