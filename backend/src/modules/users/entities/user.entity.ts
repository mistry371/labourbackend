import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, OneToOne, Index,
} from 'typeorm';
import { Address } from './address.entity';
import { Job } from '../../jobs/entities/job.entity';
import { Review } from '../../reviews/entities/review.entity';
import { Wallet } from '../../wallet/entities/wallet.entity';

export enum UserRole {
  CUSTOMER = 'customer',
  WORKER = 'worker',
  ADMIN = 'admin',
  CORPORATE = 'corporate',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  PENDING_VERIFICATION = 'pending_verification',
}

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true, unique: true, length: 15 })
  phone: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ nullable: true })
  fcmToken: string;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true, unique: true, length: 50 })
  referralCode: string;

  @Column({ nullable: true })
  referredById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Address, (address) => address.user, { cascade: true })
  addresses: Address[];

  @OneToMany(() => Job, (job) => job.customer)
  jobs: Job[];

  @OneToMany(() => Review, (review) => review.reviewer)
  reviewsGiven: Review[];

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;
}
