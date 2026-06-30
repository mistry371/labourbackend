import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn,
  OneToMany, CreateDateColumn, UpdateDateColumn, VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WalletLog } from './wallet-log.entity';

export enum WalletStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  SUSPENDED = 'suspended',
}

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.wallet, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  escrowBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEarned: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalWithdrawn: number;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  // Optimistic locking for concurrent updates
  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WalletLog, (log) => log.wallet, { cascade: true })
  logs: WalletLog[];
}
