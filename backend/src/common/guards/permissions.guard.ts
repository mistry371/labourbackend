import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { Permission, ROLE_PERMISSIONS } from '../../modules/admin/entities/admin-role.entity';
import { AdminUser } from '../../modules/admin/entities/admin-user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    // Super admin bypass
    if (user.role === 'admin') {
      const adminUser = await this.adminUserRepo.findOne({ where: { userId: user.id, isActive: true } });
      if (!adminUser) throw new ForbiddenException('Admin record not found');

      // Compute effective permissions
      const rolePerms = ROLE_PERMISSIONS[adminUser.adminRole] || [];
      const extra = adminUser.extraPermissions || [];
      const revoked = adminUser.revokedPermissions || [];

      const effective = new Set([...rolePerms, ...extra].filter(p => !revoked.includes(p)));

      const hasAll = required.every(p => effective.has(p));
      if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
