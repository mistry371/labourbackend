import { Controller, Post, Get, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ReviewType } from './entities/review.entity';

@Controller('api/v1/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  createReview(
    @CurrentUser() user: User,
    @Body() body: {
      jobId: string;
      revieweeId: string;
      type: ReviewType;
      rating: number;
      comment?: string;
      tags?: string[];
    },
  ) {
    return this.reviewsService.createReview(
      user.id, body.jobId, body.revieweeId,
      body.type, body.rating, body.comment, body.tags,
    );
  }

  @Get('user/:userId')
  getReviews(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.reviewsService.getReviewsForUser(userId, +page, +limit);
  }
}
