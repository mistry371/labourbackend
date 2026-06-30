import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('admin_logs')
@Index(['adminId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AdminLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  admin: User;

  @Column({ nullable: true })
  adminId: string;

  @Column({ length: 100 })
  action: string;

  @Column({ nullable: true })
  targetId: string;

  @Column({ nullable: true, length: 100 })
  targetType: string;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
