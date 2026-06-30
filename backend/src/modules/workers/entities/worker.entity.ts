import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn,
  OneToMany, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkerSkill } from './worker-skill.entity';
import { JobAssignment } from '../../jobs/entities/job-assignment.entity';

export enum WorkerStatus {
  PENDING_KYC = 'pending_kyc',
  KYC_SUBMITTED = 'kyc_submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum OnlineStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
}

@Entity('workers')
@Index(['currentLatitude', 'currentLongitude'])
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: WorkerStatus, default: WorkerStatus.PENDING_KYC })
  status: WorkerStatus;

  @Column({ type: 'enum', enum: OnlineStatus, default: OnlineStatus.OFFLINE })
  onlineStatus: OnlineStatus;

  @Column({ nullable: true })
  aadhaarNumber: string;

  @Column({ nullable: true })
  aadhaarFrontUrl: string;

  @Column({ nullable: true })
  aadhaarBackUrl: string;

  @Column({ nullable: true })
  panNumber: string;

  @Column({ nullable: true })
  panCardUrl: string;

  @Column({ nullable: true })
  selfieUrl: string;

  @Column({ nullable: true })
  drivingLicenseNumber: string;

  @Column({ nullable: true })
  drivingLicenseUrl: string;

  @Column({ nullable: true })
  policeVerificationUrl: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  policeVerificationStatus: 'pending' | 'approved' | 'rejected';

  @Column({ nullable: true })
  bankAccountNumber: string;

  @Column({ nullable: true })
  bankIfsc: string;

  @Column({ nullable: true })
  bankAccountName: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  currentLatitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  currentLongitude: number;

  @Column({ nullable: true })
  locationUpdatedAt: Date;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  totalJobsCompleted: number;

  @Column({ default: 0 })
  totalJobsAccepted: number;

  @Column({ default: 0 })
  totalJobsRejected: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  acceptanceRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionRate: number;

  @Column({ nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // ── IT specialization ────────────────────────────────────────────────────────
  // Whether this worker can handle remote IT sessions
  @Column({ default: false })
  remoteCapable: boolean;

  // Device expertise: e.g. ["laptop", "printer", "cctv", "networking"]
  @Column({ type: 'simple-array', nullable: true })
  deviceExpertise: string[];

  // IT certifications: e.g. ["CompTIA A+", "CCNA", "Microsoft Certified"]
  @Column({ type: 'simple-array', nullable: true })
  itCertifications: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkerSkill, (skill) => skill.worker, { cascade: true })
  skills: WorkerSkill[];

  @OneToMany(() => JobAssignment, (assignment) => assignment.worker)
  assignments: JobAssignment[];
}
