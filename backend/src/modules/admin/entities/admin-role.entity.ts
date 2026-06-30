import {
  Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum AdminRoleType {
  SUPER_ADMIN    = 'super_admin',
  OPS_ADMIN      = 'ops_admin',
  FINANCE_ADMIN  = 'finance_admin',
  RISK_ADMIN     = 'risk_admin',
}

// All granular permissions in the system
export enum Permission {
  // Users
  USERS_VIEW    = 'users:view',
  USERS_BLOCK   = 'users:block',
  USERS_DELETE  = 'users:delete',
  // Workers
  WORKERS_VIEW    = 'workers:view',
  WORKERS_KYC     = 'workers:kyc',
  WORKERS_SUSPEND = 'workers:suspend',
  // Jobs
  JOBS_VIEW     = 'jobs:view',
  JOBS_OVERRIDE = 'jobs:override',
  JOBS_CANCEL   = 'jobs:cancel',
  // Payments
  PAYMENTS_VIEW    = 'payments:view',
  PAYMENTS_REFUND  = 'payments:refund',
  PAYMENTS_RELEASE = 'payments:release',
  PAYOUTS_APPROVE  = 'payouts:approve',
  // Pricing
  PRICING_VIEW   = 'pricing:view',
  PRICING_EDIT   = 'pricing:edit',
  // Disputes
  DISPUTES_VIEW    = 'disputes:view',
  DISPUTES_RESOLVE = 'disputes:resolve',
  // Analytics
  ANALYTICS_VIEW    = 'analytics:view',
  ANALYTICS_EXPORT  = 'analytics:export',
  // System
  SYSTEM_LOGS   = 'system:logs',
  SYSTEM_CONFIG = 'system:config',
  // Admin management
  ADMINS_MANAGE = 'admins:manage',
  // Notifications
  NOTIFICATIONS_SEND = 'notifications:send',
  // Categories
  CATEGORIES_MANAGE = 'categories:manage',
}

// Default permission sets per role
export const ROLE_PERMISSIONS: Record<AdminRoleType, Permission[]> = {
  [AdminRoleType.SUPER_ADMIN]: Object.values(Permission),
  [AdminRoleType.OPS_ADMIN]: [
    Permission.USERS_VIEW, Permission.USERS_BLOCK,
    Permission.WORKERS_VIEW, Permission.WORKERS_KYC, Permission.WORKERS_SUSPEND,
    Permission.JOBS_VIEW, Permission.JOBS_OVERRIDE, Permission.JOBS_CANCEL,
    Permission.DISPUTES_VIEW, Permission.DISPUTES_RESOLVE,
    Permission.ANALYTICS_VIEW, Permission.NOTIFICATIONS_SEND,
    Permission.CATEGORIES_MANAGE,
  ],
  [AdminRoleType.FINANCE_ADMIN]: [
    Permission.PAYMENTS_VIEW, Permission.PAYMENTS_REFUND, Permission.PAYMENTS_RELEASE,
    Permission.PAYOUTS_APPROVE, Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
    Permission.USERS_VIEW, Permission.WORKERS_VIEW, Permission.JOBS_VIEW,
    Permission.SYSTEM_LOGS,
  ],
  [AdminRoleType.RISK_ADMIN]: [
    Permission.USERS_VIEW, Permission.USERS_BLOCK,
    Permission.WORKERS_VIEW, Permission.WORKERS_SUSPEND,
    Permission.JOBS_VIEW, Permission.PAYMENTS_VIEW,
    Permission.DISPUTES_VIEW, Permission.DISPUTES_RESOLVE,
    Permission.ANALYTICS_VIEW, Permission.SYSTEM_LOGS,
  ],
};

@Entity('admin_roles')
export class AdminRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AdminRoleType, unique: true })
  name: AdminRoleType;

  @Column({ length: 200 })
  displayName: string;

  @Column({ type: 'simple-array' })
  permissions: Permission[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
