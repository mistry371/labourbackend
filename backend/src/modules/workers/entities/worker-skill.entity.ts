import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, Index,
} from 'typeorm';
import { Worker } from './worker.entity';

@Entity('worker_skills')
@Index(['categoryId', 'subcategoryId'])
export class WorkerSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Worker, (worker) => worker.skills, { onDelete: 'CASCADE' })
  worker: Worker;

  @Column()
  workerId: string;

  @Column()
  categoryId: string;

  @Column({ nullable: true })
  subcategoryId: string;

  @Column({ length: 100 })
  categoryName: string;

  @Column({ nullable: true, length: 100 })
  subcategoryName: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  skillRating: number;

  @Column({ default: 0 })
  jobsCompletedInSkill: number;

  @Column({ default: true })
  isActive: boolean;

  // IT-specific: device types this worker is skilled with under this category
  @Column({ type: 'simple-array', nullable: true })
  deviceTypes: string[];

  // IT-specific: brands this worker specializes in
  @Column({ type: 'simple-array', nullable: true })
  brands: string[];

  @CreateDateColumn()
  createdAt: Date;
}
