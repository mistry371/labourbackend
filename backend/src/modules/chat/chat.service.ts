import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Job } from '../jobs/entities/job.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
  ) {}

  async getMessages(jobId: string, userId: string): Promise<Message[]> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    
    return this.messageRepo.find({
      where: { jobId },
      order: { createdAt: 'ASC' },
    });
  }

  async saveMessage(jobId: string, senderId: string, content: string): Promise<Message> {
    const msg = this.messageRepo.create({
      jobId,
      senderId,
      content,
    });
    return this.messageRepo.save(msg);
  }
}
