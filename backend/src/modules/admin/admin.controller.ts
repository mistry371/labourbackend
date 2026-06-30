import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacService } from './admin-rbac.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/manage-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { JobStatus } from '../jobs/entities/job.entity';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminRbacService: AdminRbacService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  listUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: UserStatus,
  ) {
    return this.adminService.listUsers(+page, +limit, status);
  }

  @Patch('users/:id/block')
  blockUser(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.blockUser(admin.id, userId, body.reason);
  }

  @Patch('users/:id/unblock')
  unblockUser(@CurrentUser() admin: User, @Param('id', ParseUUIDPipe) userId: string) {
    return this.adminService.unblockUser(admin.id, userId);
  }

  @Get('workers')
  listWorkers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.adminService.listAllWorkers(+page, +limit, status as any);
  }

  @Get('workers/kyc-pending')
  listPendingKyc(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.listPendingKyc(+page, +limit);
  }

  @Patch('workers/:id/kyc/approve')
  approveKyc(@CurrentUser() admin: User, @Param('id', ParseUUIDPipe) workerId: string) {
    return this.adminService.approveKyc(admin.id, workerId);
  }

  @Patch('workers/:id/kyc/reject')
  rejectKyc(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) workerId: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.rejectKyc(admin.id, workerId, body.reason);
  }

  @Get('jobs')
  listJobs(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: JobStatus,
  ) {
    return this.adminService.listAllJobs(+page, +limit, status);
  }

  @Get('analytics/revenue')
  getRevenue(@Query('days') days = 30) {
    return this.adminService.getRevenueAnalytics(+days);
  }

  // ─── Disputes ──────────────────────────────────────────────────────────────

  @Get('disputes')
  listDisputes(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.listDisputes(+page, +limit);
  }

  @Get('disputes/:jobId')
  getDisputeDetail(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.adminService.getDisputeDetail(jobId);
  }

  @Post('disputes/:jobId/refund')
  refundCustomer(
    @CurrentUser() admin: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.refundCustomer(admin.id, jobId, body.reason);
  }

  @Post('disputes/:jobId/penalize-worker')
  penalizeWorker(
    @CurrentUser() admin: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() body: { reason: string; penaltyAmount?: number },
  ) {
    return this.adminService.penalizeWorker(admin.id, jobId, body.reason, body.penaltyAmount);
  }

  @Post('disputes/:jobId/close')
  closeDispute(
    @CurrentUser() admin: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() body: { resolution: string; outcome: 'refund' | 'release' | 'split' },
  ) {
    return this.adminService.closeDispute(admin.id, jobId, body.resolution, body.outcome);
  }

  // ─── RBAC Management ───────────────────────────────────────────────────────

  @Get('rbac/admins')
  listAdminUsers() {
    return this.adminRbacService.listAdminUsers();
  }

  @Get('rbac/admins/:id')
  getAdminUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminRbacService.getAdminUser(id);
  }

  @Post('rbac/admins')
  createAdminUser(@Body() dto: CreateAdminUserDto) {
    return this.adminRbacService.createAdminUser(dto);
  }

  @Patch('rbac/admins/:id')
  updateAdminUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminRbacService.updateAdminUser(id, dto);
  }

  @Get('rbac/roles')
  listRoles() {
    return this.adminRbacService.listRoles();
  }

  @Get('rbac/permissions')
  getAllPermissions() {
    return this.adminRbacService.getAllPermissions();
  }
}
