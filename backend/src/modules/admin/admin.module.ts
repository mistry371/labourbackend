import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRbacService } from './admin-rbac.service';
import { AdminLog } from './entities/admin-log.entity';
import { AdminUser } from './entities/admin-user.entity';
import { AdminRole } from './entities/admin-role.entity';
import { User } from '../users/entities/user.entity';
import { Worker } from '../workers/entities/worker.entity';
import { Job } from '../jobs/entities/job.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletLog } from '../wallet/entities/wallet-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminLog, AdminUser, AdminRole, User, Worker, Job, Payment, Review, Wallet, WalletLog]),
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRbacService],
  exports: [AdminService, AdminRbacService, TypeOrmModule],
})
export class AdminModule {}
