import {
  Injectable, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Worker, WorkerStatus } from '../workers/entities/worker.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Msg91Service } from './msg91.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    private jwtService: JwtService,
    private config: ConfigService,
    private dataSource: DataSource,
    private msg91: Msg91Service,
  ) {}

  async registerWithPassword(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.dataSource.transaction(async (manager) => {
      const referralCode = `SERV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      let referredById: string | null = null;
      if (dto.referralCode) {
        const referrer = await manager.findOne(User, {
          where: { referralCode: dto.referralCode.trim().toUpperCase() },
        });
        if (referrer) {
          referredById = referrer.id;
        }
      }
      const newUser = manager.create(User, {
        email: dto.email,
        name: dto.name || 'User',
        passwordHash,
        role: dto.role || UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        referralCode,
        referredById,
      });
      const savedUser = await manager.save(newUser);
      const wallet = manager.create(Wallet, { userId: savedUser.id });
      await manager.save(wallet);
      if (dto.role === UserRole.WORKER) {
        const worker = manager.create(Worker, {
          userId: savedUser.id,
          status: WorkerStatus.PENDING_KYC,
        });
        await manager.save(worker);
      }
      return savedUser;
    });

    const tokens = this.generateTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }

  async loginWithPassword(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Please login with OTP. Password not set.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const tokens = this.generateTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }

  async sendOtp(dto: SendOtpDto): Promise<{ message: string }> {
    const otp = this.generateOtp();
    const key = `otp:email:${dto.email}`;
    const rateLimitKey = `otp:rate:email:${dto.email}`;
    const expirySeconds = (this.config.get<number>('otp.expiryMinutes') || 10) * 60;
    const redis = this.getRedis();

    const requestCount = await redis.incr(rateLimitKey);
    if (requestCount === 1) await redis.expire(rateLimitKey, 600);
    if (requestCount > 5) {
      throw new BadRequestException('Too many OTP requests. Please wait 10 minutes.');
    }

    await redis.setex(key, expirySeconds, otp);
    await redis.del(`otp:attempts:email:${dto.email}`);
    await this.msg91.sendEmailOtp(dto.email, otp, dto.name);

    return { message: 'OTP sent to your email' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{
    accessToken: string; refreshToken: string;
    user: Partial<User>; isNewUser: boolean;
  }> {
    const redis = this.getRedis();
    const key = `otp:email:${dto.email}`;
    const attemptsKey = `otp:attempts:email:${dto.email}`;

    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) await redis.expire(attemptsKey, 600);
    if (attempts > 5) {
      await redis.del(key);
      throw new UnauthorizedException('Too many failed attempts. Please request a new OTP.');
    }

    const storedOtp = await redis.get(key);
    if (!storedOtp || storedOtp !== dto.otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await redis.del(key);
    await redis.del(attemptsKey);

    let user = await this.userRepo.findOne({ where: { email: dto.email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.dataSource.transaction(async (manager) => {
        const referralCode = `SERV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        let referredById: string | null = null;
        if (dto.referralCode) {
          const referrer = await manager.findOne(User, {
            where: { referralCode: dto.referralCode.trim().toUpperCase() },
          });
          if (referrer) {
            referredById = referrer.id;
          }
        }
        const newUser = manager.create(User, {
          email: dto.email,
          name: dto.name || 'User',
          role: dto.role || UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          referralCode,
          referredById,
        });
        const savedUser = await manager.save(newUser);
        const wallet = manager.create(Wallet, { userId: savedUser.id });
        await manager.save(wallet);
        if (dto.role === UserRole.WORKER) {
          const worker = manager.create(Worker, {
            userId: savedUser.id,
            status: WorkerStatus.PENDING_KYC,
          });
          await manager.save(worker);
        }
        return savedUser;
      });
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Account is blocked. Contact support.');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date(), isEmailVerified: true });
    const tokens = this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user), isNewUser };
  }

  async googleLogin(googleUser: {
    email: string; name: string;
    avatarUrl: string | null; googleId: string;
  }): Promise<{ accessToken: string; refreshToken: string; user: Partial<User>; isNewUser: boolean }> {
    let user = await this.userRepo.findOne({ where: { email: googleUser.email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.dataSource.transaction(async (manager) => {
        const referralCode = `SERV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const newUser = manager.create(User, {
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.avatarUrl,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          referralCode,
        });
        const saved = await manager.save(newUser);
        const wallet = manager.create(Wallet, { userId: saved.id });
        await manager.save(wallet);
        return saved;
      });
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Account is blocked. Contact support.');
    }

    if (!user.avatarUrl && googleUser.avatarUrl) {
      await this.userRepo.update(user.id, { avatarUrl: googleUser.avatarUrl });
      user.avatarUrl = googleUser.avatarUrl;
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date(), isEmailVerified: true });
    const tokens = this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user), isNewUser };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });
      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user || user.status === UserStatus.BLOCKED) {
        throw new UnauthorizedException();
      }
      const accessToken = this.jwtService.sign(
        { sub: user.id, role: user.role, email: user.email },
        { secret: this.config.get('jwt.secret'), expiresIn: this.config.get('jwt.expiresIn') },
      );
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, role: user.role, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: this.config.get('jwt.secret'),
        expiresIn: this.config.get('jwt.expiresIn'),
      }),
      refreshToken: this.jwtService.sign(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiresIn'),
      }),
    };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeUser(user: User): Partial<User> {
    return {
      id: user.id, name: user.name, email: user.email,
      avatarUrl: user.avatarUrl, role: user.role, status: user.status,
      isEmailVerified: user.isEmailVerified,
      lastLoginAt: user.lastLoginAt, createdAt: user.createdAt,
    } as Partial<User>;
  }

  private getRedis(): Redis {
    return (global as any).__redis_client__;
  }
}
