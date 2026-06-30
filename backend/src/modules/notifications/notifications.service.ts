import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, NotificationChannel } from './entities/notification.entity';

interface SendNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
  referenceType?: string;
  data?: Record<string, any>;
  channel?: NotificationChannel;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  async send(dto: SendNotificationDto): Promise<Notification> {
    const notif = this.notifRepo.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      channel: dto.channel || NotificationChannel.IN_APP,
      referenceId: dto.referenceId,
      referenceType: dto.referenceType,
      data: dto.data,
    });
    const saved = await this.notifRepo.save(notif);

    // TODO: Integrate FCM push notifications
    // await this.sendPushNotification(dto.userId, dto.title, dto.body);

    return saved;
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { notifications, total, page, limit };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notifRepo.update(
      { id: notificationId, userId },
      { isRead: true, readAt: new Date() },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }
}
