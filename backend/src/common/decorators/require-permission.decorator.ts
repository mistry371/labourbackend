import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../modules/admin/entities/admin-role.entity';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
