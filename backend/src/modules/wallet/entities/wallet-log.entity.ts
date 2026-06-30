import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index,
} from 'typeorm';
import { Wallet } from './wallet.entity';

export enum WalletLogType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  ESCROW_HOLD = 'escrow_hold',
  ESCROW_RELEASE = 'escrow_release',
  WITHDRAWAL = 'withdrawal',
  REFUND = 'refund',
  PENALTY = 'penalty',
  BONUS = 'bonus',
}

@Entity('wallet_logs')
@Index(['walletId', 'createdAt'])
export class WalletLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.logs, { onDelete: 'CASCADE' })
  wallet: Wallet;

  @Column()
  walletId: string;

  @Column({ type: 'enum', enum: WalletLogType })
  type: WalletLogType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balanceBefore: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
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
