import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewType } from './entities/review.entity';
import { Job, JobStatus } from '../jobs/entities/job.entity';
import { Worker } from '../workers/entities/worker.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviewRepo: Repository<Review>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
  ) {}

  async createReview(
    reviewerId: string,
    jobId: string,
    revieweeId: string,
    type: ReviewType,
    rating: number,
    comment?: string,
    tags?: string[],
  ): Promise<Review> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.COMPLETED) {
      throw new BadRequestException('Can only review completed jobs');
    }

    const existing = await this.reviewRepo.findOne({
      where: { jobId, reviewerId, type },
    });
    if (existing) throw new BadRequestException('Review already submitted');

    const review = this.reviewRepo.create({
      jobId, reviewerId, revieweeId, type, rating, comment, tags,
    });
    const saved = await this.reviewRepo.save(review);

    // Update worker average rating
    if (type === ReviewType.CUSTOMER_TO_WORKER) {
      await this.updateWorkerRating(revieweeId);
    }

    return saved;
  }

  private async updateWorkerRating(userId: string): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { userId } });
    if (!worker) return;

    const result = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.revieweeId = :userId', { userId })
      .andWhere('r.type = :type', { type: ReviewType.CUSTOMER_TO_WORKER })
      .getRawOne();

    await this.workerRepo.update(worker.id, {
      averageRating: parseFloat(result?.avg || '0'),
    });
  }

  async getReviewsForUser(userId: string, page = 1, limit = 20) {
    const [reviews, total] = await this.reviewRepo.findAndCount({
      where: { revieweeId: userId },
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { reviews, total, page, limit };
  }
}
