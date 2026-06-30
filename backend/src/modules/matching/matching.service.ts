import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Worker, WorkerStatus, OnlineStatus } from '../workers/entities/worker.entity';
import { WorkerSkill } from '../workers/entities/worker-skill.entity';

export interface MatchRequest {
  jobId: string;
  categoryId: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  // IT-specific
  serviceType?: 'physical' | 'it';
  serviceMode?: 'onsite' | 'remote' | 'hybrid';
  deviceType?: string;
  brand?: string;
}

export interface RankedWorker {
  workerId: string;
  score: number;
  distanceKm: number;
  rating: number;
  acceptanceRate: number;
}

// Haversine distance in km (used for fallback + candidate pre-filter)
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private httpService: HttpService,
    private config: ConfigService,
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
    @InjectRepository(WorkerSkill) private skillRepo: Repository<WorkerSkill>,
  ) {}

  /**
   * Fetch online, approved workers with the required skill within radius,
   * then send them to the Python AI service for scoring.
   */
  async findBestWorkers(request: MatchRequest): Promise<RankedWorker[]> {
    // 1. Fetch candidate workers from DB
    const candidates = await this.fetchCandidates(request);
    if (!candidates.length) {
      this.logger.warn(`No online workers found for job ${request.jobId} (category: ${request.categoryId})`);
      return [];
    }

    // 2. Call Python AI service with candidates
    try {
      const aiUrl = this.config.get<string>('aiService.baseUrl');
      const response = await firstValueFrom(
        this.httpService.post<{ workers: RankedWorker[] }>(
          `${aiUrl}/api/v1/matching/rank-workers`,
          { ...request, candidates },
          { timeout: 5000 },
        ),
      );
      return response.data.workers || [];
    } catch (error) {
      this.logger.error('AI matching service unavailable, falling back to basic matching', error.message);
      return this.fallbackMatching(request, candidates);
    }
  }

  async getPriceEstimate(params: {
    categoryId: string;
    latitude: number;
    longitude: number;
    scheduledAt?: string;
  }): Promise<{ estimatedPrice: number; breakdown: Record<string, number> }> {
    try {
      const aiUrl = this.config.get<string>('aiService.baseUrl');
      const response = await firstValueFrom(
        this.httpService.post<{ estimatedPrice: number; breakdown: Record<string, number> }>(
          `${aiUrl}/api/v1/pricing/estimate`,
          params,
          { timeout: 3000 },
        ),
      );
      return response.data;
    } catch {
      // Return category base price from fallback config instead of 0
      const fallbackPrices: Record<string, number> = {
        'computer-laptop-services': 500, 'printer-services': 500, 'networking-services': 500,
        'cctv-security': 500, 'server-cloud': 500, 'email-business-it': 500,
        'smart-devices': 500, 'office-it-infrastructure': 500, 'cyber-security': 500,
        'mobile-tablet': 500, 'gaming-entertainment': 500, 'smart-home': 500,
        'corporate-enterprise': 500, 'installation-services': 500, 'maintenance-services': 500,
      };
      const base = fallbackPrices[params.categoryId] ?? 300;
      return { estimatedPrice: base, breakdown: { basePrice: base, total: base } };
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async fetchCandidates(request: MatchRequest) {
    // Fetch online, approved workers who have the required skill
    const workers = await this.workerRepo
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.skills', 'skill', 'skill.category_id = :categoryId AND skill.is_active = true', {
        categoryId: request.categoryId,
      })
      .where('w.status = :status', { status: WorkerStatus.APPROVED })
      .andWhere('w.online_status = :online', { online: OnlineStatus.ONLINE })
      .andWhere('w.current_latitude IS NOT NULL')
      .andWhere('w.current_longitude IS NOT NULL')
      .getMany();

    // For remote IT jobs, skip location filter entirely
    const isRemote = request.serviceMode === 'remote';

    // Pre-filter by radius (avoid sending far workers to AI)
    const filtered = isRemote
      ? workers
      : workers.filter((w) => {
          const dist = haversine(
            request.latitude, request.longitude,
            Number(w.currentLatitude), Number(w.currentLongitude),
          );
          return dist <= request.radiusKm;
        });

    // For IT jobs, additionally filter by device expertise and remote capability
    const itFiltered = request.serviceType === 'it'
      ? filtered.filter((w) => {
          if (isRemote && !w.remoteCapable) return false;
          if (request.deviceType && w.deviceExpertise?.length) {
            return w.deviceExpertise.includes(request.deviceType);
          }
          return true;
        })
      : filtered;

    return itFiltered.map((w) => ({
      workerId: w.id,
      latitude: Number(w.currentLatitude),
      longitude: Number(w.currentLongitude),
      rating: Number(w.averageRating),
      acceptanceRate: Number(w.acceptanceRate),
      jobsCompleted: w.totalJobsCompleted,
      isOnline: true,
      categoryIds: w.skills.map((s) => s.categoryId),
      remoteCapable: w.remoteCapable,
      deviceExpertise: w.deviceExpertise || [],
    }));
  }

  /** Simple distance-based fallback when AI service is down */
  private fallbackMatching(
    request: MatchRequest,
    candidates: Array<{
      workerId: string; latitude: number; longitude: number;
      rating: number; acceptanceRate: number;
    }>,
  ): RankedWorker[] {
    return candidates
      .map((w) => {
        const dist = haversine(request.latitude, request.longitude, w.latitude, w.longitude);
        return {
          workerId: w.workerId,
          score: Math.max(0, 1 - dist / request.radiusKm),
          distanceKm: Math.round(dist * 10) / 10,
          rating: w.rating,
          acceptanceRate: w.acceptanceRate,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}
