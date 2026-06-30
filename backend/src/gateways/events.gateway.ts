import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, { secret: this.config.get('jwt.secret') });
      client.data.userId = payload.sub;
      client.data.role = payload.role;

      this.connectedUsers.set(payload.sub, client.id);
      client.join(`user:${payload.sub}`);
      client.join(`role:${payload.role}`);

      this.logger.log(`Client connected: ${payload.sub} (${payload.role})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.connectedUsers.delete(client.data.userId);
      this.logger.log(`Client disconnected: ${client.data.userId}`);

      // If a worker disconnects, mark them offline
      if (client.data.role === 'worker') {
        this.dataSource.query(
          `UPDATE workers SET online_status = 'offline', updated_at = NOW()
           WHERE user_id = $1 AND online_status = 'online'`,
          [client.data.userId],
        ).catch((err) => this.logger.error('Failed to mark worker offline on disconnect', err));
      }
    }
  }

  @SubscribeMessage('worker:update-location')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { latitude: number; longitude: number },
  ) {
    if (client.data.role !== 'worker') return;

    // Validate coordinates
    const { latitude, longitude } = data ?? {};
    if (
      typeof latitude !== 'number' || typeof longitude !== 'number' ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) {
      return;
    }

    const workerId = client.data.userId;

    // Broadcast location to any customer tracking this worker
    this.server.to(`tracking:${workerId}`).emit('worker:location', {
      workerId,
      latitude,
      longitude,
      timestamp: new Date(),
    });

    // Auto-transition assigned job → worker_enroute on first location ping
    // Guard: only transition if status is exactly 'assigned' (idempotent)
    try {
      const result = await this.dataSource.query(
        `UPDATE jobs j
         SET status = 'worker_enroute', updated_at = NOW()
         FROM job_assignments ja
         WHERE ja.job_id = j.id
           AND ja.worker_id = (SELECT id FROM workers WHERE user_id = $1 LIMIT 1)
           AND ja.status = 'accepted'
           AND j.status = 'assigned'
         RETURNING j.id, j.customer_id`,
        [workerId],
      );

      if (result[1] > 0) {
        const { id: jobId, customer_id: customerId } = result[0][0];
        this.emitJobUpdate(jobId, customerId, workerId, 'worker_enroute');
        this.logger.log(`Job ${jobId} transitioned to worker_enroute`);
      }
    } catch (err) {
      this.logger.error('Failed to transition job to worker_enroute', err);
    }
  }

  @SubscribeMessage('job:track-worker')
  handleTrackWorker(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workerId: string },
  ) {
    client.join(`tracking:${data.workerId}`);
  }

  @SubscribeMessage('chat:send-message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string; content: string },
  ) {
    const senderId = client.data.userId;
    const { jobId, content } = data ?? {};
    if (!jobId || !content) return;

    try {
      const job = await this.dataSource.query(
        `SELECT j.customer_id, w.user_id AS worker_user_id
         FROM jobs j
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'accepted'
         LEFT JOIN workers w ON w.id = ja.worker_id
         WHERE j.id = $1`,
        [jobId]
      );

      if (!job || job.length === 0) return;
      const customerId = job[0].customer_id;
      const workerUserId = job[0].worker_user_id;

      if (senderId !== customerId && senderId !== workerUserId) {
        return;
      }

      const result = await this.dataSource.query(
        `INSERT INTO messages (id, job_id, sender_id, content, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW())
         RETURNING id, job_id AS "jobId", sender_id AS "senderId", content, created_at AS "createdAt"`,
        [jobId, senderId, content]
      );

      const savedMessage = result[0];

      this.emitToUser(customerId, 'chat:receive-message', savedMessage);
      if (workerUserId) {
        this.emitToUser(workerUserId, 'chat:receive-message', savedMessage);
      }
    } catch (err) {
      this.logger.error('Failed to handle chat message', err);
    }
  }

  // Emit to specific user
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Emit to all workers
  emitToWorkers(event: string, data: any) {
    this.server.to('role:worker').emit(event, data);
  }

  // Emit job status update
  emitJobUpdate(jobId: string, customerId: string, workerId: string, status: string, data?: any) {
    this.emitToUser(customerId, 'job:status-update', { jobId, status, ...data });
    if (workerId) this.emitToUser(workerId, 'job:status-update', { jobId, status, ...data });
  }
}
