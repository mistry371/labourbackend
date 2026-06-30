import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JobStatus } from '../entities/job.entity';

export class UpdateJobStatusDto {
  @IsEnum(JobStatus)
  status: JobStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
