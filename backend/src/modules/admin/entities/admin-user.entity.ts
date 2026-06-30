import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { AdminRoleType, Permission } from './admin-role.entity';

@Entity('admin_users')
@Index(['userId'], { unique: true })
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // FK to users.id

  @Column({ type: 'enum', enum: AdminRoleType, default: AdminRoleType.OPS_ADMIN })
  adminRole: AdminRoleType;

  // Extra permissions beyond role defaults (or overrides)
  @Column({ type: 'simple-array', nullable: true })
  extraPermissions: Permission[];

  // Revoked permissions from role defaults
  @Column({ type: 'simple-array', nullable: true })
  revokedPermissions: Permission[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastActiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
