import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';
import configuration from './config/configuration';
import { getTypeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkersModule } from './modules/workers/workers.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AdminModule } from './modules/admin/admin.module';
import { MatchingModule } from './modules/matching/matching.module';
import { StorageModule } from './modules/storage/storage.module';
import { EventsGateway } from './gateways/events.gateway';

import { WalletModule } from './modules/wallet/wallet.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    HttpModule,
    AuthModule,
    UsersModule,
    WorkersModule,
    JobsModule,
    PaymentsModule,
    WalletModule,
    PricingModule,
    CategoriesModule,
    CouponsModule,
    ChatModule,
    NotificationsModule,
    ReviewsModule,
    AdminModule,
    MatchingModule,
    StorageModule,
  ],
  providers: [EventsGateway],
})
export class AppModule {}
