import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  OneToMany, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';
import { User } from '../../users/entities/user.entity';
import { Transaction } from './transaction.entity';

export enum PaymentStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  CAPTURED = 'captured',
  ESCROW_HELD = 'escrow_held',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  FAILED = 'failed',
  DISPUTED = 'disputed',
}

export enum PaymentMethod {
  RAZORPAY = 'razorpay',
  WALLET = 'wallet',
  CASH = 'cash',
}

@Entity('payments')
@Index(['status', 'createdAt'])
@Index(['razorpayOrderId'], { unique: true, where: '"razorpayOrderId" IS NOT NULL' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job, (job) => job.payments, { onDelete: 'RESTRICT' })
  job: Job;

  @Column()
  jobId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  customer: User;

  @Column()
  customerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  workerAmount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.INITIATED })
  status: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.RAZORPAY })
  method: PaymentMethod;

  @Column({ nullable: true })
  razorpayOrderId: string;

  @Column({ nullable: true })
  razorpayPaymentId: string;

  @Column({ nullable: true })
  razorpaySignature: string;

  @Column({ nullable: true })
  escrowReleasedAt: Date;

  @Column({ nullable: true })
  refundedAt: Date;

  @Column({ nullable: true, length: 500 })
  refundReason: string;

  @Column({ type: 'jsonb', nullable: true })
  razorpayResponse: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Transaction, (tx) => tx.payment, { cascade: true })
  transactions: Transaction[];
}
