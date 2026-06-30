import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletLog, WalletLogType } from '../wallet/entities/wallet-log.entity';
import { Job, JobStatus } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpay: Razorpay;

  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(WalletLog) private walletLogRepo: Repository<WalletLog>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    private config: ConfigService,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
  ) {
    this.razorpay = new Razorpay({
      key_id: config.get('razorpay.keyId'),
      key_secret: config.get('razorpay.keySecret'),
    });
  }

  async createOrder(jobId: string, customerId: string): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    paymentId: string;
  }> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.customerId !== customerId) throw new BadRequestException('Unauthorized');

    // Idempotency: return existing initiated/escrow order if one already exists
    const existing = await this.paymentRepo.findOne({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
    if (existing && [PaymentStatus.INITIATED, PaymentStatus.ESCROW_HELD].includes(existing.status)) {
      const amountPaise = Math.round(Number(existing.amount) * 100);
      return {
        orderId: existing.razorpayOrderId,
        amount: amountPaise,
        currency: 'INR',
        paymentId: existing.id,
      };
    }

    const amount = Number(job.estimatedPrice);
    const amountPaise = Math.round(amount * 100); // Razorpay uses paise

    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `job_${jobId}`,
      notes: { jobId, customerId },
    });

    const platformFee = (amount * this.config.get<number>('platformFeePercent')) / 100;
    const workerAmount = amount - platformFee;

    const payment = this.paymentRepo.create({
      jobId,
      customerId,
      amount,
      platformFee,
      workerAmount,
      status: PaymentStatus.INITIATED,
      method: PaymentMethod.RAZORPAY,
      razorpayOrderId: order.id,
    });
    const saved = await this.paymentRepo.save(payment);

    return {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      paymentId: saved.id,
    };
  }

  async verifyAndCapturePayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<Payment> {
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', this.config.get('razorpay.keySecret'))
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw new BadRequestException('Invalid payment signature');
    }

    const payment = await this.paymentRepo.findOne({
      where: { razorpayOrderId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Idempotency: already captured — validate it's the same payment then return
    if (payment.status === PaymentStatus.ESCROW_HELD) {
      if (payment.razorpayPaymentId && payment.razorpayPaymentId !== razorpayPaymentId) {
        throw new BadRequestException('Payment ID mismatch on duplicate capture attempt');
      }
      return payment;
    }

    // Update payment to escrow held
    await this.paymentRepo.update(payment.id, {
      status: PaymentStatus.ESCROW_HELD,
      razorpayPaymentId,
      razorpaySignature,
    });

    this.logger.log(`Payment ${payment.id} captured and held in escrow`);
    return this.paymentRepo.findOne({ where: { id: payment.id } });
  }

  async releaseEscrow(jobId: string, customerId: string): Promise<void> {
    // Use a transaction with pessimistic locking to prevent double-release
    await this.dataSource.transaction(async (manager) => {
      // Lock the payment row to prevent concurrent releases
      const payment = await manager
        .createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.job_id = :jobId AND p.status = :status', {
          jobId,
          status: PaymentStatus.ESCROW_HELD,
        })
        .getOne();

      if (!payment) {
        // Check if already released (idempotent)
        const released = await manager.findOne(Payment, {
          where: { jobId, status: PaymentStatus.RELEASED },
        });
        if (released) return; // already done — no-op
        throw new NotFoundException('No escrow payment found for this job');
      }

      const job = await manager.findOne(Job, {
        where: { id: jobId },
        relations: ['assignments', 'assignments.worker'],
      });
      if (!job || job.status !== JobStatus.COMPLETED) {
        throw new BadRequestException('Job must be completed before releasing escrow');
      }

      const activeAssignment = job.assignments.find(
        (a) => a.status === 'accepted' || a.status === 'completed',
      );
      if (!activeAssignment) throw new BadRequestException('No active worker assignment found');

      // Update payment status
      await manager.update(Payment, payment.id, {
        status: PaymentStatus.RELEASED,
        escrowReleasedAt: new Date(),
      });

      // Credit worker wallet
      const workerWallet = await manager
        .createQueryBuilder(Wallet, 'w')
        .setLock('pessimistic_write')
        .where('w.user_id = :userId', { userId: activeAssignment.worker.userId })
        .getOne();

      if (workerWallet) {
        const balanceBefore = Number(workerWallet.balance);
        const newBalance = balanceBefore + Number(payment.workerAmount);
        const newTotalEarned = Number(workerWallet.totalEarned) + Number(payment.workerAmount);

        await manager.update(Wallet, workerWallet.id, {
          balance: newBalance,
          totalEarned: newTotalEarned,
        });

        const log = manager.create(WalletLog, {
          walletId: workerWallet.id,
          type: WalletLogType.CREDIT,
          amount: payment.workerAmount,
          balanceBefore,
          balanceAfter: newBalance,
          description: `Earnings from job ${jobId}`,
          referenceId: payment.id,
        });
        await manager.save(log);

        // Record transaction
        const tx = manager.create(Transaction, {
          paymentId: payment.id,
          userId: activeAssignment.worker.userId,
          type: TransactionType.ESCROW_RELEASE,
          amount: payment.workerAmount,
          balanceBefore,
          balanceAfter: newBalance,
          description: `Escrow released for job ${jobId}`,
          referenceId: jobId,
        });
        await manager.save(tx);
      }

      // ─── Referral rewards check ───
      const customer = await manager.findOne(User, { where: { id: job.customerId } });
      if (customer && customer.referredById) {
        const completedJobsCount = await manager.count(Job, {
          where: { customerId: customer.id, status: JobStatus.COMPLETED },
        });
        if (completedJobsCount === 1) {
          const alreadyRewarded = customer.metadata?.referralRewarded === true;
          if (!alreadyRewarded) {
            await this.creditReferralBonuses(manager, customer.id, customer.referredById);
            customer.metadata = { ...(customer.metadata || {}), referralRewarded: true };
            await manager.save(User, customer);
          }
        }
      }

      const workerUser = await manager.findOne(User, { where: { id: activeAssignment.worker.userId } });
      if (workerUser && workerUser.referredById) {
        const completedJobsCount = activeAssignment.worker.totalJobsCompleted + 1;
        if (completedJobsCount === 1) {
          const alreadyRewarded = workerUser.metadata?.referralRewarded === true;
          if (!alreadyRewarded) {
            await this.creditReferralBonuses(manager, workerUser.id, workerUser.referredById);
            workerUser.metadata = { ...(workerUser.metadata || {}), referralRewarded: true };
            await manager.save(User, workerUser);
          }
        }
      }
    });

    // Notify worker (outside transaction — non-critical)
    const payment = await this.paymentRepo.findOne({ where: { jobId, status: PaymentStatus.RELEASED } });
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['assignments', 'assignments.worker'],
    });
    const activeAssignment = job?.assignments?.find(
      (a) => a.status === 'accepted' || a.status === 'completed',
    );
    if (activeAssignment && payment) {
      await this.notificationsService.send({
        userId: activeAssignment.worker.userId,
        type: NotificationType.PAYMENT_RELEASED,
        title: 'Payment Released',
        body: `₹${payment.workerAmount} has been credited to your wallet.`,
        referenceId: payment.id,
        referenceType: 'payment',
      });
    }
  }

  async processRefund(paymentId: string, reason: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    // Idempotency: already refunded
    if (payment.status === PaymentStatus.REFUNDED) return;

    if (payment.status !== PaymentStatus.ESCROW_HELD) {
      throw new BadRequestException('Payment not in escrow');
    }

    // Initiate Razorpay refund
    await this.razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(Number(payment.amount) * 100),
      notes: { reason },
    });

    await this.paymentRepo.update(paymentId, {
      status: PaymentStatus.REFUNDED,
      refundedAt: new Date(),
      refundReason: reason,
    });
  }

  async getPaymentHistory(userId: string, page = 1, limit = 20) {
    const [payments, total] = await this.paymentRepo.findAndCount({
      where: { customerId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { payments, total, page, limit };
  }

  async handleWebhook(body: any, signature: string): Promise<void> {
    const expectedSignature = crypto
      .createHmac('sha256', this.config.get('razorpay.webhookSecret'))
      .update(JSON.stringify(body))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { event, payload } = body;
    this.logger.log(`Razorpay webhook: ${event}`);

    if (event === 'payment.failed') {
      const orderId = payload.payment.entity.order_id;
      await this.paymentRepo.update(
        { razorpayOrderId: orderId },
        { status: PaymentStatus.FAILED },
      );
    }
  }

  private async creditReferralBonuses(manager: any, newUserId: string, referrerId: string) {
    const rewardAmount = 100; // ₹100 reward
    
    // 1. Credit new user
    const newUserWallet = await manager.findOne(Wallet, { where: { userId: newUserId } });
    if (newUserWallet) {
      const balanceBefore = Number(newUserWallet.balance);
      await manager.update(Wallet, newUserWallet.id, {
        balance: balanceBefore + rewardAmount,
      });
      const log = manager.create(WalletLog, {
        walletId: newUserWallet.id,
        type: WalletLogType.BONUS,
        amount: rewardAmount,
        balanceBefore,
        balanceAfter: balanceBefore + rewardAmount,
        description: 'Referral Signup Bonus',
      });
      await manager.save(log);
    }

    // 2. Credit referrer
    const referrerWallet = await manager.findOne(Wallet, { where: { userId: referrerId } });
    if (referrerWallet) {
      const balanceBefore = Number(referrerWallet.balance);
      await manager.update(Wallet, referrerWallet.id, {
        balance: balanceBefore + rewardAmount,
        totalEarned: Number(referrerWallet.totalEarned) + rewardAmount,
      });
      const log = manager.create(WalletLog, {
        walletId: referrerWallet.id,
        type: WalletLogType.BONUS,
        amount: rewardAmount,
        balanceBefore,
        balanceAfter: balanceBefore + rewardAmount,
        description: 'Referral Invitation Bonus',
      });
      await manager.save(log);
    }
  }
}
