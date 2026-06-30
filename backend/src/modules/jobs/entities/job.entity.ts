import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JobAssignment } from './job-assignment.entity';
import { JobStatusHistory } from './job-status-history.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Review } from '../../reviews/entities/review.entity';
import { JobStatus, JobPriority, ServiceType, ServiceMode } from './job-status.enum';

export { JobStatus, JobPriority, ServiceType, ServiceMode };

// IT-specific dynamic attributes stored in JSONB
export interface ItAttributes {
  deviceType?: string;       // e.g. "laptop", "printer", "cctv"
  brand?: string;            // e.g. "Dell", "HP", "Hikvision"
  model?: string;
  issueType?: string;        // e.g. "screen_damage", "no_power", "network_issue"
  issueDescription?: string;
  urgency?: string;          // ItUrgency enum value
  serialNumber?: string;
  purchaseYear?: number;
  warrantyStatus?: 'in_warranty' | 'out_of_warranty' | 'unknown';
  remoteAccessAvailable?: boolean;
  preferredTime?: string;
}

// Diagnostic report submitted by worker
export interface DiagnosticReport {
  rootCause: string;
  recommendedAction: string;
  partsRequired: { name: string; estimatedCost: number }[];
  laborCost: number;
  diagnosticFee: number;
  totalEstimate: number;
  canBeRemote: boolean;
  estimatedDurationHours: number;
  notes?: string;
  submittedAt: string;
}

@Entity('jobs')
@Index(['status', 'createdAt'])
@Index(['categoryId', 'status'])
@Index(['scheduledAt'])
@Index(['serviceType', 'serviceMode'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.jobs, { onDelete: 'RESTRICT' })
  customer: User;

  @Column()
  customerId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  categoryId: string;

  @Column({ length: 100 })
  categoryName: string;

  @Column({ nullable: true })
  serviceId: string;

  @Column({ nullable: true, length: 150 })
  serviceName: string;

  // ── Service classification ──────────────────────────────────────────────────
  @Column({ type: 'enum', enum: ServiceType, default: ServiceType.PHYSICAL })
  serviceType: ServiceType;

  @Column({ type: 'enum', enum: ServiceMode, default: ServiceMode.ONSITE })
  serviceMode: ServiceMode;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Column({ type: 'enum', enum: JobPriority, default: JobPriority.NORMAL })
  priority: JobPriority;

  // ── Pricing ─────────────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  estimatedPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  finalPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  platformFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  workerEarnings: number;

  // IT-specific price breakdown
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  diagnosticFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  repairCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  partsCost: number;

  // ── Location ─────────────────────────────────────────────────────────────────
  @Column({ type: 'text' })
  jobAddress: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  jobLatitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  jobLongitude: number;

  @Column({ nullable: true })
  scheduledAt: Date;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true, length: 500 })
  cancellationReason: string;

  @Column({ nullable: true })
  cancelledBy: string;

  // OTP for job start verification
  @Column({ nullable: true, length: 6 })
  startOtp: string;

  @Column({ nullable: true })
  startOtpExpiresAt: Date;

  // OTP for job completion verification
  @Column({ nullable: true, length: 6 })
  completionOtp: string;

  @Column({ nullable: true })
  completionOtpExpiresAt: Date;

  @Column({ type: 'simple-array', nullable: true })
  mediaUrls: string[];

  @Column({ type: 'simple-array', nullable: true })
  beforePhotos: string[];

  @Column({ type: 'simple-array', nullable: true })
  proofUrls: string[];

  @Column({ type: 'text', nullable: true })
  completionNotes: string;

  // ── IT-specific fields ───────────────────────────────────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  itAttributes: ItAttributes;

  @Column({ type: 'jsonb', nullable: true })
  diagnosticReport: DiagnosticReport;

  // Timestamp when customer approved the diagnostic price quote
  @Column({ nullable: true })
  priceApprovedAt: Date;

  @Column({ nullable: true })
  priceRejectedAt: Date;

  @Column({ nullable: true, length: 500 })
  priceRejectionReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => JobAssignment, (assignment) => assignment.job, { cascade: true })
  assignments: JobAssignment[];

  @OneToMany(() => JobStatusHistory, (history) => history.job, { cascade: true })
  statusHistory: JobStatusHistory[];

  @OneToMany(() => Payment, (payment) => payment.job)
  payments: Payment[];

  @OneToMany(() => Review, (review) => review.job)
  reviews: Review[];
}
