import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { Worker, WorkerStatus } from '../workers/entities/worker.entity';
import { Job, JobStatus } from '../jobs/entities/job.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { AdminLog } from './entities/admin-log.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletLog, WalletLogType } from '../wallet/entities/wallet-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(AdminLog) private logRepo: Repository<AdminLog>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(WalletLog) private walletLogRepo: Repository<WalletLog>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
  ) {}

  async getDashboardStats() {
    const [totalUsers, totalWorkers, activeJobs, todayRevenue] = await Promise.all([
      this.userRepo.count(),
      this.workerRepo.count({ where: { status: WorkerStatus.APPROVED } }),
      this.jobRepo.count({ where: { status: JobStatus.IN_PROGRESS } }),
      this.getTodayRevenue(),
    ]);

    const pendingKyc = await this.workerRepo.count({ where: { status: WorkerStatus.KYC_SUBMITTED } });

    return { totalUsers, totalWorkers, activeJobs, todayRevenue, pendingKyc };
  }

  private async getTodayRevenue(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: PaymentStatus.RELEASED })
      .andWhere('p.createdAt BETWEEN :start AND :end', { start: today, end: tomorrow })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  async listUsers(page = 1, limit = 20, status?: UserStatus) {
    const where = status ? { status } : {};
    const [users, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { users, total, page, limit };
  }

  async blockUser(adminId: string, userId: string, reason: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.update(userId, { status: UserStatus.BLOCKED });
    await this.logAction(adminId, 'BLOCK_USER', userId, 'user', { reason });
  }

  async listPendingKyc(page = 1, limit = 20) {
    const [workers, total] = await this.workerRepo.findAndCount({
      where: { status: WorkerStatus.KYC_SUBMITTED },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { workers, total, page, limit };
  }

  async approveKyc(adminId: string, workerId: string): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    await this.workerRepo.update(workerId, {
      status: WorkerStatus.APPROVED,
      policeVerificationStatus: 'approved',
      approvedAt: new Date(),
      approvedBy: adminId,
    });
    await this.logAction(adminId, 'APPROVE_KYC', workerId, 'worker');
  }

  async rejectKyc(adminId: string, workerId: string, reason: string): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    await this.workerRepo.update(workerId, {
      status: WorkerStatus.REJECTED,
      policeVerificationStatus: 'rejected',
      rejectionReason: reason,
    });
    await this.logAction(adminId, 'REJECT_KYC', workerId, 'worker', { reason });
  }

  async listAllJobs(page = 1, limit = 20, status?: JobStatus) {
    const where = status ? { status } : {};
    const [jobs, total] = await this.jobRepo.findAndCount({
      where,
      relations: ['customer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { jobs, total, page, limit };
  }

  async listAllWorkers(page = 1, limit = 20, status?: WorkerStatus) {
    const where = status ? { status } : {};
    const [workers, total] = await this.workerRepo.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { workers, total, page, limit };
  }

  async unblockUser(adminId: string, userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(userId, { status: UserStatus.ACTIVE });
    await this.logAction(adminId, 'UNBLOCK_USER', userId, 'user');
  }

  async getRevenueAnalytics(days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const result = await this.paymentRepo
      .createQueryBuilder('p')
      .select("DATE_TRUNC('day', p.createdAt)", 'date')
      .addSelect('SUM(p.amount)', 'revenue')
      .addSelect('SUM(p.platformFee)', 'platformFee')
      .addSelect('COUNT(*)', 'transactions')
      .where('p.status = :status', { status: PaymentStatus.RELEASED })
      .andWhere('p.createdAt >= :from', { from })
      .groupBy("DATE_TRUNC('day', p.createdAt)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return result;
  }

  // ─── Disputes ──────────────────────────────────────────────────────────────

  async listDisputes(page = 1, limit = 20) {
    const [jobs, total] = await this.jobRepo.findAndCount({
      where: { status: JobStatus.DISPUTED },
      relations: ['customer', 'assignments', 'assignments.worker', 'assignments.worker.user', 'payments'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { disputes: jobs, total, page, limit };
  }

  async getDisputeDetail(jobId: string) {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: [
        'customer',
        'assignments',
        'assignments.worker',
        'assignments.worker.user',
        'payments',
        'reviews',
        'reviews.reviewer',
      ],
    });
    if (!job) throw new NotFoundException('Job not found');

    // Fetch admin action history for this dispute
    const logs = await this.logRepo.find({
      where: { targetId: jobId, targetType: 'dispute' },
      order: { createdAt: 'ASC' },
    });

    return { job, adminLogs: logs };
  }

  async refundCustomer(adminId: string, jobId: string, reason: string): Promise<void> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['payments'],
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.DISPUTED) throw new BadRequestException('Job is not in disputed state');

    const payment = job.payments?.find(
      (p) => [PaymentStatus.ESCROW_HELD, PaymentStatus.DISPUTED].includes(p.status),
    );
    if (!payment) throw new NotFoundException('No eligible payment found for refund');

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Payment, payment.id, {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundReason: reason,
      });
      await manager.update(Job, jobId, { status: JobStatus.CANCELLED });
    });

    await this.notificationsService.send({
      userId: job.customerId,
      type: NotificationType.PAYMENT_RELEASED,
      title: 'Refund Processed',
      body: `Your dispute has been resolved. ₹${payment.amount} will be refunded within 5–7 business days.`,
      referenceId: jobId,
      referenceType: 'job',
    });

    await this.logAction(adminId, 'DISPUTE_REFUND_CUSTOMER', jobId, 'dispute', { reason, amount: payment.amount });
  }

  async penalizeWorker(adminId: string, jobId: string, reason: string, penaltyAmount?: number): Promise<void> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['assignments', 'assignments.worker', 'assignments.worker.user'],
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.DISPUTED) throw new BadRequestException('Job is not in disputed state');

    const activeAssignment = job.assignments?.find(
      (a) => ['accepted', 'active', 'completed'].includes(a.status),
    );
    if (!activeAssignment?.worker) throw new NotFoundException('No worker found for this job');

    const worker = activeAssignment.worker;

    // Suspend worker
    await this.workerRepo.update(worker.id, {
      status: WorkerStatus.SUSPENDED,
      rejectionReason: `Suspended due to dispute: ${reason}`,
    });

    // Deduct penalty from wallet if specified
    if (penaltyAmount && penaltyAmount > 0) {
      const wallet = await this.walletRepo.findOne({ where: { userId: worker.userId } });
      if (wallet && Number(wallet.balance) >= penaltyAmount) {
        const balanceBefore = Number(wallet.balance);
        await this.walletRepo.update(wallet.id, { balance: balanceBefore - penaltyAmount });
        const log = this.walletLogRepo.create({
          walletId: wallet.id,
          type: WalletLogType.PENALTY,
          amount: penaltyAmount,
          balanceBefore,
          balanceAfter: balanceBefore - penaltyAmount,
          description: `Penalty: dispute on job ${jobId}`,
          referenceId: jobId,
          metadata: { reason, adminId },
        });
        await this.walletLogRepo.save(log);
      }
    }

    await this.notificationsService.send({
      userId: worker.userId,
      type: NotificationType.SYSTEM,
      title: 'Account Action',
      body: `Your account has been suspended due to a dispute. Reason: ${reason}`,
      referenceId: jobId,
      referenceType: 'job',
    });

    await this.logAction(adminId, 'DISPUTE_PENALIZE_WORKER', jobId, 'dispute', {
      reason, workerId: worker.id, penaltyAmount,
    });
  }

  async closeDispute(adminId: string, jobId: string, resolution: string, outcome: 'refund' | 'release' | 'split'): Promise<void> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['assignments', 'assignments.worker', 'assignments.worker.user', 'payments'],
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.DISPUTED) throw new BadRequestException('Job is not in disputed state');

    const payment = job.payments?.find(
      (p) => [PaymentStatus.ESCROW_HELD, PaymentStatus.DISPUTED].includes(p.status),
    );

    const activeAssignment = job.assignments?.find(
      (a) => ['accepted', 'active', 'completed'].includes(a.status),
    );

    await this.dataSource.transaction(async (manager) => {
      if (outcome === 'refund' && payment) {
        await manager.update(Payment, payment.id, {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          refundReason: resolution,
        });
        await manager.update(Job, jobId, { status: JobStatus.CANCELLED });
      } else if (outcome === 'release' && payment && activeAssignment?.worker) {
        await manager.update(Payment, payment.id, {
          status: PaymentStatus.RELEASED,
          escrowReleasedAt: new Date(),
        });
        await manager.update(Job, jobId, { status: JobStatus.COMPLETED });

        // Credit worker wallet
        const wallet = await manager.findOne(Wallet, { where: { userId: activeAssignment.worker.userId } });
        if (wallet) {
          const balanceBefore = Number(wallet.balance);
          const credit = Number(payment.workerAmount);
          await manager.update(Wallet, wallet.id, {
            balance: balanceBefore + credit,
            totalEarned: Number(wallet.totalEarned) + credit,
          });
          const log = manager.create(WalletLog, {
            walletId: wallet.id,
            type: WalletLogType.CREDIT,
            amount: credit,
            balanceBefore,
            balanceAfter: balanceBefore + credit,
            description: `Dispute resolved — payment released for job ${jobId}`,
            referenceId: payment.id,
          });
          await manager.save(log);
        }
      } else {
        // split or no payment — just close
        await manager.update(Job, jobId, { status: JobStatus.CANCELLED });
        if (payment) {
          await manager.update(Payment, payment.id, { status: PaymentStatus.REFUNDED, refundedAt: new Date() });
        }
      }
    });

    // Notify both parties
    const notifyIds = [job.customerId];
    if (activeAssignment?.worker?.userId) notifyIds.push(activeAssignment.worker.userId);
    await Promise.all(notifyIds.map((uid) =>
      this.notificationsService.send({
        userId: uid,
        type: NotificationType.SYSTEM,
        title: 'Dispute Resolved',
        body: `Your dispute for job has been resolved. ${resolution}`,
        referenceId: jobId,
        referenceType: 'job',
      }),
    ));

    await this.logAction(adminId, 'DISPUTE_CLOSED', jobId, 'dispute', { resolution, outcome });
  }

  private async logAction(
    adminId: string,
    action: string,
    targetId: string,
    targetType: string,
    metadata?: Record<string, any>,
  ) {
    const log = this.logRepo.create({ adminId, action, targetId, targetType, metadata });
    await this.logRepo.save(log);
  }
}
