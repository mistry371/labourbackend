import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index, JoinColumn,
  Tree, TreeParent, TreeChildren
} from 'typeorm';

export enum PricingModel {
  FIXED   = 'fixed',
  HOURLY  = 'hourly',
  DAILY   = 'daily',
  BIDDING = 'bidding',
}

// JSON schema field definition for dynamic forms
export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'textarea' | 'boolean' | 'file' | 'range';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  unit?: string; // e.g. "sq ft", "hours"
  helpText?: string;
}

@Entity('service_categories')
@Tree('materialized-path')
@Index(['slug'], { unique: true })
export class ServiceCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 120 })
  slug: string; // e.g. "plumbing", "plumbing-pipe-repair"

  @Column({ length: 255, nullable: true })
  description: string;

  @Column({ nullable: true, length: 10 })
  icon: string; // emoji or icon name

  @Column({ nullable: true })
  imageUrl: string;

  @TreeParent()
  parent: ServiceCategory;

  @TreeChildren()
  children: ServiceCategory[];

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  // Pricing
  @Column({ type: 'enum', enum: PricingModel, default: PricingModel.FIXED })
  pricingModel: PricingModel;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxPrice: number;

  @Column({ nullable: true, length: 20 })
  priceUnit: string; // e.g. "per hour", "per visit", "per sq ft"

  @Column({ type: 'varchar', length: 100, nullable: true })
  estimatedDuration: string;

  @Column({ type: 'simple-array', nullable: true })
  requiredWorkerSkills: string[];

  @Column({ type: 'simple-array', nullable: true })
  requiredTools: string[];

  @Column({ default: false })
  emergencyServiceAvailable: boolean;

  @Column({ default: true })
  homeVisitAvailable: boolean;

  // Dynamic form schema — JSON array of FormField
  @Column({ type: 'jsonb', default: [] })
  formSchema: FormField[];

  // SEO
  @Column({ nullable: true, length: 200 })
  metaTitle: string;

  @Column({ nullable: true, length: 500 })
  metaDescription: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // ── IT service classification ─────────────────────────────────────────────
  @Column({ type: 'enum', enum: ['physical', 'it'], default: 'physical' })
  serviceType: 'physical' | 'it';

  // Supported service modes for this category
  @Column({ type: 'simple-array', nullable: true })
  supportedModes: string[]; // 'onsite' | 'remote' | 'hybrid'

  // Diagnostic fee charged before repair quote (IT only)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  diagnosticFee: number;

  // Device types applicable to this IT category
  @Column({ type: 'simple-array', nullable: true })
  deviceTypes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
