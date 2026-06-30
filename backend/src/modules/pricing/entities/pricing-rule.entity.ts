import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export interface TimeRule {
  /** Label shown in UI, e.g. "Evening Peak" */
  label: string;
  /** 0–23 */
  startHour: number;
  /** 0–23 (exclusive) */
  endHour: number;
  /** Days this rule applies: 0=Sun … 6=Sat. Empty = all days */
  days: number[];
  /** Multiplier, e.g. 1.25 */
  multiplier: number;
  enabled: boolean;
}

@Entity('pricing_rules')
@Index(['categoryId'], { unique: true })
export class PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Matches categoryId used in jobs, e.g. "plumbing" */
  @Column({ unique: true, length: 100 })
  categoryId: string;

  @Column({ length: 100 })
  categoryName: string;

  /** Base price in INR */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  /** Minimum price floor regardless of discounts */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 150 })
  minPrice: number;

  /** Whether surge pricing is active for this category */
  @Column({ default: true })
  surgeEnabled: boolean;

  /** Hard cap on surge multiplier (e.g. 3.0 = max 3× base) */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 3.0 })
  maxSurgeFactor: number;

  /** Time-based pricing rules (JSONB array) */
  @Column({ type: 'jsonb', default: [] })
  timeRules: TimeRule[];

  /** Whether this category is currently active */
  @Column({ default: true })
  isActive: boolean;

  /** Free-text notes for admin */
  @Column({ nullable: true, length: 500 })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
