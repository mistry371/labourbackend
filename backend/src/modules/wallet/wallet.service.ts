import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, WalletStatus } from './entities/wallet.entity';
import { WalletLog, WalletLogType } from './entities/wallet-log.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(WalletLog) private logRepo: Repository<WalletLog>,
  ) {}

  async getBalance(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getLogs(userId: string, page = 1, limit = 20) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const [logs, total] = await this.logRepo.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { logs, total, page, limit };
  }

  async requestWithdrawal(userId: string, amount: number): Promise<{ message: string }> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.status !== WalletStatus.ACTIVE) throw new BadRequestException('Wallet is not active');
    if (Number(wallet.balance) < amount) throw new BadRequestException('Insufficient balance');
    if (amount < 100) throw new BadRequestException('Minimum withdrawal is ₹100');

    // In production: create withdrawal request, process via bank transfer
    // For now: deduct balance and log
    const balanceBefore = Number(wallet.balance);
    await this.walletRepo.update(wallet.id, {
      balance: balanceBefore - amount,
      totalWithdrawn: Number(wallet.totalWithdrawn) + amount,
    });

    const log = this.logRepo.create({
      walletId: wallet.id,
      type: WalletLogType.WITHDRAWAL,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore - amount,
      description: 'Withdrawal request processed',
    });
    await this.logRepo.save(log);

    return { message: 'Withdrawal request submitted. Will be processed within 24 hours.' };
  }
}
