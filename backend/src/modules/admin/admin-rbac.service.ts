import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from './entities/admin-user.entity';
import { AdminRole, AdminRoleType, Permission, ROLE_PERMISSIONS } from './entities/admin-role.entity';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/manage-admin.dto';

@Injectable()
export class AdminRbacService {
  constructor(
    @InjectRepository(AdminUser) private adminUserRepo: Repository<AdminUser>,
    @InjectRepository(AdminRole) private adminRoleRepo: Repository<AdminRole>,
  ) {}

  /** Resolve effective permissions for an admin user */
  getEffectivePermissions(adminUser: AdminUser): Permission[] {
    const base = ROLE_PERMISSIONS[adminUser.adminRole] ?? [];
    const extra = adminUser.extraPermissions ?? [];
    const revoked = new Set(adminUser.revokedPermissions ?? []);
    const merged = new Set([...base, ...extra]);
    revoked.forEach(p => merged.delete(p));
    return Array.from(merged);
  }

  async listAdminUsers() {
    return this.adminUserRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createAdminUser(dto: CreateAdminUserDto): Promise<AdminUser> {
    const existing = await this.adminUserRepo.findOne({ where: { userId: dto.userId } });
    if (existing) throw new ConflictException('User is already an admin');

    const adminUser = this.adminUserRepo.create({
      userId: dto.userId,
      adminRole: dto.adminRole,
      extraPermissions: dto.extraPermissions ?? [],
      revokedPermissions: [],
      isActive: true,
    });
    return this.adminUserRepo.save(adminUser);
  }

  async updateAdminUser(id: string, dto: UpdateAdminUserDto): Promise<AdminUser> {
    const adminUser = await this.adminUserRepo.findOne({ where: { id } });
    if (!adminUser) throw new NotFoundException('Admin user not found');

    Object.assign(adminUser, {
      ...(dto.adminRole !== undefined && { adminRole: dto.adminRole }),
      ...(dto.extraPermissions !== undefined && { extraPermissions: dto.extraPermissions }),
      ...(dto.revokedPermissions !== undefined && { revokedPermissions: dto.revokedPermissions }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.adminUserRepo.save(adminUser);
  }

  async getAdminUser(id: string): Promise<AdminUser & { effectivePermissions: Permission[] }> {
    const adminUser = await this.adminUserRepo.findOne({ where: { id } });
    if (!adminUser) throw new NotFoundException('Admin user not found');
    return { ...adminUser, effectivePermissions: this.getEffectivePermissions(adminUser) };
  }

  async listRoles() {
    return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      permissions,
      permissionCount: permissions.length,
    }));
  }

  async getAllPermissions() {
    return Object.values(Permission);
  }
}
