import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Job } from './job.entity';
import { Worker } from '../../workers/entities/worker.entity';

export enum AssignmentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

@Entity('job_assignments')
export class JobAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job, (job) => job.assignments, { onDelete: 'CASCADE' })
  job: Job;

  @Column()
  jobId: string;

  @ManyToOne(() => Worker, (worker) => worker.assignments, { onDelete: 'RESTRICT' })
  worker: Worker;

  @Column()
  workerId: string;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status: AssignmentStatus;

  @Column({ nullable: true })
  respondedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ nullable: true, length: 500 })
  rejectionReason: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  workerLatitudeAtAssignment: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  workerLongitudeAtAssignment: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  distanceKm: number;

  @Column({ default: 1 })
  attemptNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
