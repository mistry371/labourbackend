import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index,
} from 'typeorm';
import { Payment } from './payment.entity';
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  ESCROW_HOLD = 'escrow_hold',
  ESCROW_RELEASE = 'escrow_release',
  REFUND = 'refund',
  PLATFORM_FEE = 'platform_fee',
  WITHDRAWAL = 'withdrawal',
  PENALTY = 'penalty',
  BONUS = 'bonus',
}

@Entity('transactions')
@Index(['userId', 'createdAt'])
@Index(['type', 'createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, (payment) => payment.transactions, { nullable: true, onDelete: 'SET NULL' })
  payment: Payment;

  @Column({ nullable: true })
  paymentId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceBefore: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: number;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
