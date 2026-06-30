import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn,
} from 'typeorm';
import { Job } from './job.entity';
import { JobStatus } from './job-status.enum';

@Entity('job_status_history')
export class JobStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job, (job) => job.statusHistory, { onDelete: 'CASCADE' })
  job: Job;

  @Column()
  jobId: string;

  @Column({ type: 'enum', enum: JobStatus })
  fromStatus: JobStatus;

  @Column({ type: 'enum', enum: JobStatus })
  toStatus: JobStatus;

  @Column({ nullable: true })
  changedBy: string;

  @Column({ nullable: true, length: 500 })
  note: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
