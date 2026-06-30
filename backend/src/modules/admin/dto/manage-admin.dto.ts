import { IsEnum, IsUUID, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { AdminRoleType, Permission } from '../entities/admin-role.entity';

export class CreateAdminUserDto {
  @IsUUID()
  userId: string;

  @IsEnum(AdminRoleType)
  adminRole: AdminRoleType;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  extraPermissions?: Permission[];
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(AdminRoleType)
  adminRole?: AdminRoleType;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  extraPermissions?: Permission[];

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  revokedPermissions?: Permission[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
