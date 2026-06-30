import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { SubmitDiagnosticDto, ApprovePriceDto } from './dto/submit-diagnostic.dto';

@Controller('api/v1/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  createJob(@CurrentUser() user: User, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(user.id, dto);
  }

  @Get('my')
  @Roles(UserRole.CUSTOMER)
  getMyJobs(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.jobsService.getCustomerJobs(user.id, +page, +limit);
  }

  @Get('worker/feed')
  @Roles(UserRole.WORKER)
  getWorkerFeed(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.jobsService.getWorkerFeed(user.id, +page, +limit);
  }

  @Get('worker/assignments')
  @Roles(UserRole.WORKER)
  getWorkerJobs(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.jobsService.getWorkerJobs(user.id, +page, +limit);
  }

  @Get(':id')
  getJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.getJobById(id);
  }

  @Post(':id/respond')
  @Roles(UserRole.WORKER)
  @HttpCode(HttpStatus.OK)
  respondToJob(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() body: { accept: boolean; reason?: string },
  ) {
    return this.jobsService.respondToAssignment(user.id, jobId, body.accept, body.reason);
  }

  @Post(':id/start')
  @Roles(UserRole.WORKER)
  @HttpCode(HttpStatus.OK)
  startJob(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() body: { otp: string; beforePhotos?: string[] },
  ) {
    return this.jobsService.startJob(user.id, jobId, body.otp, body.beforePhotos);
  }

  @Post(':id/complete')
  @Roles(UserRole.WORKER)
  @HttpCode(HttpStatus.OK)
  completeJob(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() body: { proofUrls: string[]; otp: string; notes?: string },
  ) {
    return this.jobsService.completeJob(user.id, jobId, body.proofUrls, body.otp, body.notes);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelJob(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() body: { reason: string },
  ) {
    return this.jobsService.cancelJob(user.id, jobId, body.reason);
  }

  @Post(':id/generate-otp')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  generateOtp(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobsService.generateStartOtp(user.id, jobId);
  }

  @Post(':id/generate-completion-otp')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  generateCompletionOtp(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobsService.generateCompletionOtp(user.id, jobId);
  }

  @Get(':id/invoice')
  @HttpCode(HttpStatus.OK)
  getInvoice(
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobsService.generateInvoiceHtml(jobId);
  }

  @Post('estimate-price')
  @HttpCode(HttpStatus.OK)
  estimatePrice(@Body() body: { categoryId: string; latitude: number; longitude: number; scheduledAt?: string }) {
    return this.jobsService.estimatePrice(body);
  }

  // ── IT Diagnostic Flow ────────────────────────────────────────────────────

  @Post(':id/diagnostic')
  @Roles(UserRole.WORKER)
  @HttpCode(HttpStatus.OK)
  submitDiagnostic(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() dto: SubmitDiagnosticDto,
  ) {
    return this.jobsService.submitDiagnostic(user.id, jobId, dto);
  }

  @Post(':id/approve-price')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  approveDiagnosticPrice(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() dto: ApprovePriceDto,
  ) {
    return this.jobsService.approveDiagnosticPrice(user.id, jobId, dto);
  }
}
