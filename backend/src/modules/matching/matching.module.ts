import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingService } from './matching.service';
import { Worker } from '../workers/entities/worker.entity';
import { WorkerSkill } from '../workers/entities/worker-skill.entity';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([Worker, WorkerSkill]),
  ],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
