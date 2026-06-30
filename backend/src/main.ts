import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { seedDemoAccounts } from './database/seeds/demo.seed';
import helmet from 'helmet';
import compression from 'compression';
import Redis from 'ioredis';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS — reads ALLOWED_ORIGINS env var (comma-separated)
  const rawOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map(o => o.trim());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Railway health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Redis client — supports rediss:// (TLS) for Upstash
  const redisUrl = process.env.REDIS_URL;
  const redisClient = redisUrl
    ? new Redis(redisUrl, {
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      })
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
  (global as any).__redis_client__ = redisClient;

  // Serve uploaded files as static assets
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Health check endpoint (used by Railway / load balancers)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/v1/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Backend running on http://0.0.0.0:${port}`);

  // Seed demo accounts after startup
  try {
    const dataSource = app.get(getDataSourceToken());
    await seedDemoAccounts(dataSource);
  } catch (e: any) {
    logger.warn(`Seed skipped: ${e.message}`);
  }
}

bootstrap();
