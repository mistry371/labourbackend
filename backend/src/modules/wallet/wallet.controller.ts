import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { IsNumber, Min } from 'class-validator';

class WithdrawDto {
  @IsNumber()
  @Min(100)
  amount: number;
}

@Controller('api/v1/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@CurrentUser() user: User) {
    return this.walletService.getBalance(user.id);
  }

  @Get('logs')
  getLogs(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.walletService.getLogs(user.id, +page, +limit);
  }

  @Post('withdraw')
  requestWithdrawal(@CurrentUser() user: User, @Body() body: WithdrawDto) {
    return this.walletService.requestWithdrawal(user.id, body.amount);
  }
}
