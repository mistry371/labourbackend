import {
  Controller, Post, Get, Body, Param, Query,
  UseGuards, Headers, RawBodyRequest, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  createOrder(@CurrentUser() user: User, @Body() body: { jobId: string }) {
    return this.paymentsService.createOrder(body.jobId, user.id);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verifyPayment(
    @Body() body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    return this.paymentsService.verifyAndCapturePayment(
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
    );
  }

  @Post(':jobId/release-escrow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  releaseEscrow(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.paymentsService.releaseEscrow(jobId, user.id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.paymentsService.getPaymentHistory(user.id, +page, +limit);
  }

  // Razorpay webhook — no auth, signature verified internally
  @Post('webhook/razorpay')
  handleWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(body, signature);
  }
}
