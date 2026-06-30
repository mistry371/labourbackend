import {
  Controller, Get, Post, Patch, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { WorkersService } from './workers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('api/v1/workers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.WORKER)
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.workersService.getProfile(user.id);
  }

  @Post('kyc')
  submitKyc(@CurrentUser() user: User, @Body() dto: SubmitKycDto) {
    return this.workersService.submitKyc(user.id, dto);
  }

  @Patch('online-status')
  @HttpCode(HttpStatus.OK)
  toggleOnline(@CurrentUser() user: User, @Body() body: { online: boolean }) {
    return this.workersService.toggleOnlineStatus(user.id, body.online);
  }

  @Patch('location')
  @HttpCode(HttpStatus.OK)
  updateLocation(@CurrentUser() user: User, @Body() dto: UpdateLocationDto) {
    return this.workersService.updateLocation(user.id, dto);
  }

  @Post('skills')
  addSkill(@CurrentUser() user: User, @Body() body: any) {
    return this.workersService.addSkill(user.id, body);
  }

  @Get('earnings')
  getEarnings(@CurrentUser() user: User) {
    return this.workersService.getEarningsSummary(user.id);
  }
}
