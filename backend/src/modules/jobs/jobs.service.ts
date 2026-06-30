import {
  Injectable, NotFoundException, BadRequestException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job, JobStatus, ServiceType } from './entities/job.entity';
import { JobAssignment, AssignmentStatus } from './entities/job-assignment.entity';
import { JobStatusHistory } from './entities/job-status-history.entity';
import { Worker, OnlineStatus } from '../workers/entities/worker.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { SubmitDiagnosticDto, ApprovePriceDto } from './dto/submit-diagnostic.dto';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(JobAssignment) private assignmentRepo: Repository<JobAssignment>,
    @InjectRepository(JobStatusHistory) private historyRepo: Repository<JobStatusHistory>,
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
    private matchingService: MatchingService,
    private notificationsService: NotificationsService,
    private dataSource: DataSource,
  ) {}

  async createJob(customerId: string, dto: CreateJobDto): Promise<Job> {
    const job = this.jobRepo.create({
      ...(dto as any),
      customerId,
      status: JobStatus.PENDING,
      serviceType: dto.serviceType ?? ServiceType.PHYSICAL,
    });
    const saved = (await this.jobRepo.save(job) as unknown) as Job;

    this.triggerMatching(saved.id).catch((err) =>
      this.logger.error(`Matching failed for job ${saved.id}`, err),
    );

    return saved;
  }

  async triggerMatching(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    await this.jobRepo.update(jobId, { status: JobStatus.MATCHING });

    // Call Python matching service
    const rankedWorkers = await this.matchingService.findBestWorkers({
      jobId,
      categoryId: job.categoryId,
      latitude: Number(job.jobLatitude),
      longitude: Number(job.jobLongitude),
      radiusKm: 10,
    });

    if (!rankedWorkers.length) {
      this.logger.warn(`No workers found for job ${jobId}`);
      await this.jobRepo.update(jobId, { status: JobStatus.PENDING });
      return;
    }

    // Assign to top-ranked worker
    const topWorker = rankedWorkers[0];
    await this.assignJobToWorker(jobId, topWorker.workerId, topWorker.distanceKm);
  }

  async assignJobToWorker(jobId: string, workerId: string, distanceKm: number): Promise<void> {
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 min to respond

    await this.dataSource.transaction(async (manager) => {
      const assignment = manager.create(JobAssignment, {
        jobId,
        workerId,
        status: AssignmentStatus.PENDING,
        expiresAt,
        distanceKm,
      });
      await manager.save(assignment);
      await manager.update(Job, jobId, { status: JobStatus.ASSIGNED });
    });

    // Notify worker
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['user'],
    });
    if (worker) {
      await this.notificationsService.send({
        userId: worker.userId,
        type: NotificationType.JOB_ASSIGNED,
        title: 'New Job Request',
        body: 'You have a new job request. Respond within 2 minutes.',
        referenceId: jobId,
        referenceType: 'job',
      });
    }
  }

  async respondToAssignment(
    workerId: string,
    jobId: string,
    accept: boolean,
    reason?: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { jobId, workerId, status: AssignmentStatus.PENDING },
    });

    if (!assignment) {
      // Idempotency: if already accepted by this worker, treat as success
      if (accept) {
        const accepted = await this.assignmentRepo.findOne({
          where: { jobId, workerId, status: AssignmentStatus.ACCEPTED },
        });
        if (accepted) return;
      }
      throw new NotFoundException('Assignment not found or already responded');
    }
    if (assignment.expiresAt < new Date()) throw new BadRequestException('Assignment expired');

    await this.dataSource.transaction(async (manager) => {
      if (accept) {
        await manager.update(JobAssignment, assignment.id, {
          status: AssignmentStatus.ACCEPTED,
          respondedAt: new Date(),
        });
        await manager.update(Job, jobId, { status: JobStatus.ASSIGNED });
      } else {
        await manager.update(JobAssignment, assignment.id, {
          status: AssignmentStatus.REJECTED,
          respondedAt: new Date(),
          rejectionReason: reason,
        });
        // Re-trigger matching only if job hasn't been cancelled
        const currentJob = await manager.findOne(Job, { where: { id: jobId } });
        if (currentJob && currentJob.status === JobStatus.ASSIGNED) {
          this.triggerMatching(jobId).catch(console.error);
        }
      }
    });
  }

  async startJob(workerId: string, jobId: string, otp: string, beforePhotos?: string[]): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    // Idempotency: already started
    if (job.status === JobStatus.IN_PROGRESS) return;
    if (job.status !== JobStatus.ASSIGNED) throw new BadRequestException('Job not in assigned state');
    if (!job.startOtp) throw new BadRequestException('OTP not generated yet. Ask customer to generate OTP.');
    if (job.startOtp !== otp) throw new BadRequestException('Invalid OTP');
    if (job.startOtpExpiresAt < new Date()) throw new BadRequestException('OTP expired');

    await this.dataSource.transaction(async (manager) => {
      // Clear OTP after use to prevent replay attacks
      await manager.update(Job, jobId, {
        status: JobStatus.IN_PROGRESS,
        startedAt: new Date(),
        startOtp: null,
        startOtpExpiresAt: null,
        beforePhotos: beforePhotos || [],
      });
      await this.recordStatusHistory(manager, jobId, job.status, JobStatus.IN_PROGRESS, workerId, 'Job started by worker');
    });
  }

  async completeJob(workerId: string, jobId: string, proofUrls: string[], otp: string, notes?: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    // Idempotency: already completed
    if (job.status === JobStatus.COMPLETED) return;
    if (job.status !== JobStatus.IN_PROGRESS) throw new BadRequestException('Job not in progress');
    if (!job.completionOtp) throw new BadRequestException('Completion OTP not generated yet. Ask customer for completion OTP.');
    if (job.completionOtp !== otp) throw new BadRequestException('Invalid completion OTP');
    if (job.completionOtpExpiresAt < new Date()) throw new BadRequestException('Completion OTP expired');
    if (!Array.isArray(proofUrls) || proofUrls.length === 0) {
      throw new BadRequestException('At least one proof image is required');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Job, jobId, {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        proofUrls,
        completionNotes: notes || '',
        completionOtp: null,
        completionOtpExpiresAt: null,
      });
      await this.recordStatusHistory(manager, jobId, job.status, JobStatus.COMPLETED, workerId);
    });

    // Notify customer
    await this.notificationsService.send({
      userId: job.customerId,
      type: NotificationType.JOB_COMPLETED,
      title: 'Job Completed',
      body: 'Your job has been completed. Please review and release payment.',
      referenceId: jobId,
      referenceType: 'job',
    });
  }

  async cancelJob(userId: string, jobId: string, reason: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    const cancellableStatuses = [JobStatus.PENDING, JobStatus.MATCHING, JobStatus.ASSIGNED];
    if (!cancellableStatuses.includes(job.status)) {
      throw new BadRequestException('Job cannot be cancelled at this stage');
    }

    await this.jobRepo.update(jobId, {
      status: JobStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancellationReason: reason,
    });
  }

  async getJobById(jobId: string): Promise<Job> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['customer', 'assignments', 'assignments.worker', 'statusHistory', 'payments'],
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async getCustomerJobs(customerId: string, page = 1, limit = 20) {
    const [jobs, total] = await this.jobRepo.findAndCount({
      where: { customerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { jobs, total, page, limit };
  }

  async getWorkerJobs(workerId: string, page = 1, limit = 20) {
    const [assignments, total] = await this.assignmentRepo.findAndCount({
      where: { workerId },
      relations: ['job', 'job.customer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { assignments, total, page, limit };
  }

  async generateStartOtp(customerId: string, jobId: string): Promise<{ otp: string }> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.customerId !== customerId) throw new ForbiddenException('Not your job');
    if (job.status !== JobStatus.ASSIGNED) throw new BadRequestException('Job must be assigned before generating OTP');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await this.jobRepo.update(jobId, { startOtp: otp, startOtpExpiresAt: expiresAt });

    // Notify customer with OTP
    await this.notificationsService.send({
      userId: customerId,
      type: NotificationType.JOB_ASSIGNED,
      title: 'Your Job OTP',
      body: `Share this OTP with the worker to start the job: ${otp}`,
      referenceId: jobId,
      referenceType: 'job',
    });

    return { otp };
  }

  async getWorkerFeed(workerId: string, page = 1, limit = 20) {
    // Return both pending assignments and accepted jobs
    const [assignments, total] = await this.assignmentRepo.findAndCount({
      where: { workerId },
      relations: ['job', 'job.customer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { assignments, total, page, limit };
  }

  async estimatePrice(params: { categoryId: string; latitude: number; longitude: number; scheduledAt?: string }) {
    return this.matchingService.getPriceEstimate(params);
  }

  // ── IT Diagnostic Flow ────────────────────────────────────────────────────

  /**
   * Worker submits a diagnostic report after initial inspection.
   * Transitions: in_progress → awaiting_price_approval
   */
  async submitDiagnostic(workerId: string, jobId: string, dto: SubmitDiagnosticDto): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.serviceType !== ServiceType.IT) {
      throw new BadRequestException('Diagnostic flow is only for IT service jobs');
    }
    if (job.status !== JobStatus.IN_PROGRESS && job.status !== JobStatus.AWAITING_DIAGNOSIS) {
      throw new BadRequestException('Job must be in progress or awaiting diagnosis');
    }

    const totalEstimate = dto.diagnosticFee + dto.laborCost +
      dto.partsRequired.reduce((sum, p) => sum + p.estimatedCost, 0);

    const report = {
      ...dto,
      totalEstimate,
      submittedAt: new Date().toISOString(),
    };

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Job, jobId, {
        status: JobStatus.AWAITING_PRICE_APPROVAL,
        diagnosticReport: report,
        diagnosticFee: dto.diagnosticFee,
        repairCost: dto.laborCost,
        partsCost: dto.partsRequired.reduce((sum, p) => sum + p.estimatedCost, 0),
        estimatedPrice: totalEstimate,
      });
      await this.recordStatusHistory(
        manager, jobId, job.status, JobStatus.AWAITING_PRICE_APPROVAL,
        workerId, 'Diagnostic report submitted',
      );
    });

    // Notify customer to approve/reject the price quote
    await this.notificationsService.send({
      userId: job.customerId,
      type: NotificationType.JOB_ASSIGNED,
      title: 'Diagnostic Complete — Approve Quote',
      body: `Your technician has diagnosed the issue. Total estimate: ₹${totalEstimate}. Please approve or reject.`,
      referenceId: jobId,
      referenceType: 'job',
    });

    return this.jobRepo.findOne({ where: { id: jobId } }) as Promise<Job>;
  }

  /**
   * Customer approves or rejects the diagnostic price quote.
   * Approve → price_approved (worker proceeds with repair)
   * Reject  → price_rejected (job ends, diagnostic fee still charged)
   */
  async approveDiagnosticPrice(customerId: string, jobId: string, dto: ApprovePriceDto): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.customerId !== customerId) throw new ForbiddenException('Not your job');
    if (job.status !== JobStatus.AWAITING_PRICE_APPROVAL) {
      throw new BadRequestException('Job is not awaiting price approval');
    }

    const newStatus = dto.approved ? JobStatus.PRICE_APPROVED : JobStatus.PRICE_REJECTED;
    const updateData: Partial<Job> = {
      status: newStatus,
      ...(dto.approved
        ? { priceApprovedAt: new Date() }
        : { priceRejectedAt: new Date(), priceRejectionReason: dto.rejectionReason }),
    };

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Job, jobId, updateData);
      await this.recordStatusHistory(
        manager, jobId, job.status, newStatus,
        customerId,
        dto.approved ? 'Customer approved price quote' : `Customer rejected: ${dto.rejectionReason}`,
      );
    });

    // Notify worker of customer decision
    const assignment = await this.assignmentRepo.findOne({
      where: { jobId, status: AssignmentStatus.ACCEPTED },
      relations: ['worker'],
    });
    if (assignment?.worker) {
      await this.notificationsService.send({
        userId: assignment.worker.userId,
        type: NotificationType.JOB_ASSIGNED,
        title: dto.approved ? 'Quote Approved — Proceed with Repair' : 'Quote Rejected by Customer',
        body: dto.approved
          ? 'The customer has approved your price quote. Proceed with the repair.'
          : `Customer rejected the quote. Reason: ${dto.rejectionReason || 'Not specified'}`,
        referenceId: jobId,
        referenceType: 'job',
      });
    }

    return this.jobRepo.findOne({ where: { id: jobId } }) as Promise<Job>;
  }

  private async updateJobStatus(
    jobId: string,
    newStatus: JobStatus,
    changedBy: string,
    note?: string,
  ) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Job, jobId, { status: newStatus });
      await this.recordStatusHistory(manager, jobId, job.status, newStatus, changedBy, note);
    });
  }

  private async recordStatusHistory(
    manager: any,
    jobId: string,
    from: JobStatus,
    to: JobStatus,
    changedBy: string,
    note?: string,
  ) {
    const history = manager.create(JobStatusHistory, {
      jobId,
      fromStatus: from,
      toStatus: to,
      changedBy,
      note,
    });
    await manager.save(history);
  }

  async generateCompletionOtp(customerId: string, jobId: string): Promise<{ otp: string }> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.customerId !== customerId) throw new ForbiddenException('Not your job');
    if (job.status !== JobStatus.IN_PROGRESS) throw new BadRequestException('Job must be in progress to generate completion OTP');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await this.jobRepo.update(jobId, { completionOtp: otp, completionOtpExpiresAt: expiresAt });

    // Notify customer with completion OTP
    await this.notificationsService.send({
      userId: customerId,
      type: NotificationType.JOB_COMPLETED,
      title: 'Your Job Completion OTP',
      body: `Share this OTP with the worker to confirm completion of the job: ${otp}`,
      referenceId: jobId,
      referenceType: 'job',
    });

    return { otp };
  }

  async generateInvoiceHtml(jobId: string): Promise<string> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['customer', 'assignments', 'assignments.worker', 'assignments.worker.user'],
    });
    if (!job) throw new NotFoundException('Job not found');

    const amount = Number(job.finalPrice || job.estimatedPrice);
    const tax = amount * 0.18; // 18% GST
    const baseVal = amount - tax;

    const workerName = job.assignments?.find(a => a.status === 'accepted' || a.status === 'completed')?.worker?.user?.name || 'Technician';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${job.id.substring(0,8)}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 40px; line-height: 1.5; }
          .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3eb87a; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #1e7047; }
          .title { font-size: 28px; font-weight: bold; text-align: right; }
          .meta-info { margin-top: 30px; display: flex; justify-content: space-between; }
          .details-table { width: 100%; border-collapse: collapse; margin-top: 40px; text-align: left; }
          .details-table th { background: #f0fbf0; padding: 12px; border-bottom: 1px solid #ddd; }
          .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
          .totals { margin-top: 30px; text-align: right; }
          .totals div { margin-bottom: 8px; }
          .grand-total { font-size: 20px; font-weight: bold; color: #1e7047; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
          @media print {
            body { margin: 0; }
            .invoice-box { border: none; box-shadow: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div>
              <div class="logo">Suvidhaye IT Services</div>
              <div>Door-to-Door Tech Support</div>
              <div>support@suvidhaye.com</div>
            </div>
            <div>
              <div class="title">INVOICE</div>
              <div>Invoice #: INV-${job.id.substring(0,8).toUpperCase()}</div>
              <div>Date: ${new Date(job.completedAt || job.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="meta-info">
            <div>
              <strong>Billed To:</strong><br>
              ${job.customer?.name || 'Customer'}<br>
              ${job.customer?.email || ''}<br>
              Address: ${job.jobAddress}
            </div>
            <div>
              <strong>Technician:</strong><br>
              ${workerName}<br>
              Job ID: ${job.id}<br>
              Mode: ${job.serviceMode.toUpperCase()}
            </div>
          </div>

          <table class="details-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>${job.title}</strong><br>
                  Category: ${job.categoryName}<br>
                  ${job.description.substring(0, 100)}...
                </td>
                <td>1</td>
                <td>₹${baseVal.toFixed(2)}</td>
                <td>₹${baseVal.toFixed(2)}</td>
              </tr>
              ${job.diagnosticFee && Number(job.diagnosticFee) > 0 ? `
              <tr>
                <td>Pre-Diagnostic Fee</td>
                <td>1</td>
                <td>₹${Number(job.diagnosticFee).toFixed(2)}</td>
                <td>₹${Number(job.diagnosticFee).toFixed(2)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="totals">
            <div>Subtotal: ₹${(baseVal + Number(job.diagnosticFee || 0)).toFixed(2)}</div>
            <div>GST (18%): ₹${tax.toFixed(2)}</div>
            <div class="grand-total">Grand Total: ₹${amount.toFixed(2)}</div>
          </div>

          <div class="footer">
            Thank you for choosing Suvidhaye! All IT repairs are covered under a 90-day warranty service.
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
