import { Controller, Get, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('api/v1/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages/:jobId')
  getMessages(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.chatService.getMessages(jobId, user.id);
  }
}
