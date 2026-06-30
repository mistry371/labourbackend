import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { JobAssignment } from './entities/job-assignment.entity';
import { JobStatusHistory } from './entities/job-status-history.entity';
import { Worker } from '../workers/entities/worker.entity';
import { User } from '../users/entities/user.entity';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, JobAssignment, JobStatusHistory, Worker, User]),
    MatchingModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
