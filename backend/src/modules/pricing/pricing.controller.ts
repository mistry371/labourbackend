import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { UpsertPricingRuleDto } from './dto/upsert-pricing-rule.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('api/v1/pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  /** Public — consumed by AI service and frontend price preview */
  @Get('config')
  getPublicConfig() {
    return this.pricingService.getPublicConfig();
  }

  /** IT diagnostic estimate — proxies to AI service */
  @Post('diagnostic-estimate')
  @HttpCode(HttpStatus.OK)
  getDiagnosticEstimate(@Body() body: {
    categoryId: string;
    deviceType: string;
    brand?: string;
    issueType: string;
    urgency?: string;
  }) {
    return this.pricingService.getDiagnosticEstimate(body);
  }

  /** Admin-only CRUD below */
  @Get('rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.pricingService.findAll();
  }

  @Post('rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  upsert(@Body() dto: UpsertPricingRuleDto) {
    return this.pricingService.upsert(dto);
  }

  @Patch('rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateOne(@Param('id') id: string, @Body() dto: Partial<UpsertPricingRuleDto>) {
    return this.pricingService.updateOne(id, dto);
  }

  @Delete('rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.pricingService.remove(id);
  }
}
