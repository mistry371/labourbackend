import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Worker, WorkerStatus, OnlineStatus } from './entities/worker.entity';
import { WorkerSkill } from './entities/worker-skill.entity';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
    @InjectRepository(WorkerSkill) private skillRepo: Repository<WorkerSkill>,
    private dataSource: DataSource,
  ) {}

  async getProfile(userId: string): Promise<Worker> {
    const worker = await this.workerRepo.findOne({
      where: { userId },
      relations: ['user', 'skills'],
    });
    if (!worker) throw new NotFoundException('Worker profile not found');
    return worker;
  }

  async submitKyc(userId: string, dto: SubmitKycDto): Promise<Worker> {
    const worker = await this.workerRepo.findOne({ where: { userId } });
    if (!worker) throw new NotFoundException('Worker profile not found');
    if (worker.status === WorkerStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    await this.workerRepo.update(worker.id, {
      ...dto,
      status: WorkerStatus.KYC_SUBMITTED,
    });

    return this.workerRepo.findOne({ where: { id: worker.id } });
  }

  async toggleOnlineStatus(userId: string, online: boolean): Promise<{ onlineStatus: OnlineStatus }> {
    const worker = await this.workerRepo.findOne({ where: { userId } });
    if (!worker) throw new NotFoundException('Worker not found');
    if (worker.status !== WorkerStatus.APPROVED) {
      throw new ForbiddenException('KYC must be approved to go online');
    }

    const status = online ? OnlineStatus.ONLINE : OnlineStatus.OFFLINE;
    await this.workerRepo.update(worker.id, { onlineStatus: status });
    return { onlineStatus: status };
  }

  async updateLocation(userId: string, dto: UpdateLocationDto): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { userId } });
    if (!worker) return;

    await this.workerRepo.update(worker.id, {
      currentLatitude: dto.latitude,
      currentLongitude: dto.longitude,
      locationUpdatedAt: new Date(),
    });
  }

  async addSkill(userId: string, skill: Partial<WorkerSkill>): Promise<WorkerSkill> {
    const worker = await this.workerRepo.findOne({ where: { userId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const existing = await this.skillRepo.findOne({
      where: { workerId: worker.id, categoryId: skill.categoryId, subcategoryId: skill.subcategoryId },
    });
    if (existing) throw new BadRequestException('Skill already added');

    const newSkill = this.skillRepo.create({ ...skill, workerId: worker.id });
    return this.skillRepo.save(newSkill);
  }

  async getEarningsSummary(userId: string) {
    const worker = await this.workerRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker not found');

    // Period boundaries
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Earnings per period from wallet logs (escrow_release = actual earning)
    const periodEarnings = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(CASE WHEN wl.created_at >= $2 THEN wl.amount ELSE 0 END), 0)::float AS today,
        COALESCE(SUM(CASE WHEN wl.created_at >= $3 THEN wl.amount ELSE 0 END), 0)::float AS week,
        COALESCE(SUM(CASE WHEN wl.created_at >= $4 THEN wl.amount ELSE 0 END), 0)::float AS month
      FROM wallet_logs wl
      JOIN wallets w ON w.id = wl.wallet_id
      WHERE w.user_id = $1
        AND wl.type IN ('credit', 'escrow_release')
    `, [userId, todayStart, weekStart, monthStart]);

    // Last 30 days daily chart data
    const chartData = await this.dataSource.query(`
      SELECT
        DATE(wl.created_at) AS date,
        COALESCE(SUM(wl.amount), 0)::float AS amount,
        COUNT(*)::int AS transactions
      FROM wallet_logs wl
      JOIN wallets w ON w.id = wl.wallet_id
      WHERE w.user_id = $1
        AND wl.type IN ('credit', 'escrow_release')
        AND wl.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(wl.created_at)
      ORDER BY date ASC
    `, [userId]);

    // Recent completed jobs with earnings
    const completedJobs = await this.dataSource.query(`
      SELECT
        j.id,
        j.title,
        j.category_name AS "categoryName",
        j.completed_at AS "completedAt",
        j.worker_earnings AS "workerEarnings",
        j.estimated_price AS "estimatedPrice",
        r.rating
      FROM jobs j
      JOIN job_assignments ja ON ja.job_id = j.id
      JOIN workers wk ON wk.id = ja.worker_id
      LEFT JOIN reviews r ON r.job_id = j.id AND r.type = 'customer_to_worker'
      WHERE wk.user_id = $1
        AND j.status = 'completed'
        AND ja.status IN ('accepted', 'completed')
      ORDER BY j.completed_at DESC
      LIMIT 20
    `, [userId]);

    // Withdrawal history from wallet logs
    const withdrawals = await this.dataSource.query(`
      SELECT
        wl.id,
        wl.amount::float,
        wl.description,
        wl.created_at AS "createdAt",
        wl.metadata
      FROM wallet_logs wl
      JOIN wallets w ON w.id = wl.wallet_id
      WHERE w.user_id = $1
        AND wl.type = 'withdrawal'
      ORDER BY wl.created_at DESC
      LIMIT 10
    `, [userId]);

    const pe = periodEarnings[0] ?? { today: 0, week: 0, month: 0 };

    // Fetch wallet for totalEarned
    const walletRow = await this.dataSource.query(
      `SELECT total_earned::float AS "totalEarned", balance::float AS balance
       FROM wallets WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const walletData = walletRow[0] ?? { totalEarned: 0, balance: 0 };

    return {
      // Wallet summary
      totalEarned: walletData.totalEarned,
      walletBalance: walletData.balance,
      averageRating: Number(worker.averageRating),
      totalJobsCompleted: worker.totalJobsCompleted,
      acceptanceRate: Number(worker.acceptanceRate),
      completionRate: Number(worker.completionRate),
      // Period earnings
      periods: {
        today:  Number(pe.today),
        week:   Number(pe.week),
        month:  Number(pe.month),
      },
      // Chart: fill gaps with 0 for last 30 days
      chart: chartData.map((d: any) => ({
        date: d.date,
        amount: Number(d.amount),
        transactions: Number(d.transactions),
      })),
      // Recent jobs
      completedJobs: completedJobs.map((j: any) => ({
        id: j.id,
        title: j.title,
        categoryName: j.categoryName,
        completedAt: j.completedAt,
        earnings: Number(j.workerEarnings ?? Number(j.estimatedPrice) * 0.85),
        rating: j.rating ? Number(j.rating) : null,
      })),
      // Withdrawals
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        amount: Number(w.amount),
        description: w.description,
        createdAt: w.createdAt,
        status: w.metadata?.status ?? 'processed',
      })),
    };
  }
}
