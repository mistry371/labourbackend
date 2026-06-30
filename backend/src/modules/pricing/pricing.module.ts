import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { PricingRule } from './entities/pricing-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule]), HttpModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule implements OnModuleInit {
  constructor(private readonly pricingService: PricingService) {}

  async onModuleInit() {
    await this.pricingService.seedDefaults();
  }
}
