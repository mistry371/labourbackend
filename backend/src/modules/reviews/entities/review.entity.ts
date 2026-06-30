import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Job } from '../../jobs/entities/job.entity';

export enum ReviewType {
  CUSTOMER_TO_WORKER = 'customer_to_worker',
  WORKER_TO_CUSTOMER = 'worker_to_customer',
}

@Entity('reviews')
@Index(['revieweeId', 'type'])
@Index(['jobId'], { unique: false })
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job, (job) => job.reviews, { onDelete: 'CASCADE' })
  job: Job;

  @Column()
  jobId: string;

  @ManyToOne(() => User, (user) => user.reviewsGiven, { onDelete: 'RESTRICT' })
  reviewer: User;

  @Column()
  reviewerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  reviewee: User;

  @Column()
  revieweeId: string;

  @Column({ type: 'enum', enum: ReviewType })
  type: ReviewType;

  @Column({ type: 'decimal', precision: 2, scale: 1 })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: false })
  isHidden: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
