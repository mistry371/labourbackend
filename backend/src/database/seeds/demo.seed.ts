/**
 * Auto-seed demo accounts on startup.
 * Called from main.ts after DB connects.
 */
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { User, UserRole, UserStatus } from '../../modules/users/entities/user.entity';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import { Worker, WorkerStatus } from '../../modules/workers/entities/worker.entity';
import * as bcrypt from 'bcrypt';

const logger = new Logger('DemoSeed');

const ACCOUNTS = [
  {
    email: 'mistryjenish1003@gmail.com',
    name: 'Jenish Admin',
    role: UserRole.ADMIN,
  },
  {
    email: 'mistryjenish1234@gmail.com',
    name: 'Jenish Customer',
    role: UserRole.CUSTOMER,
  },
  {
    email: 'jenscodersindia@gmail.com',
    name: 'Jenish Worker',
    role: UserRole.WORKER,
  },
];

export async function seedDemoAccounts(dataSource: DataSource): Promise<void> {
  try {
    const userRepo   = dataSource.getRepository(User);
    const walletRepo = dataSource.getRepository(Wallet);
    const workerRepo = dataSource.getRepository(Worker);

    const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

    for (const acc of ACCOUNTS) {
      let user = await userRepo.findOne({ where: { email: acc.email } });

      if (!user) {
        user = userRepo.create({
          email: acc.email,
          name: acc.name,
          role: acc.role,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          passwordHash: defaultPasswordHash,
        });
        user = await userRepo.save(user);

        // Wallet for every user
        const existing = await walletRepo.findOne({ where: { userId: user.id } });
        if (!existing) {
          await walletRepo.save(walletRepo.create({ userId: user.id }));
        }

        // Worker profile
        if (acc.role === UserRole.WORKER) {
          const existingWorker = await workerRepo.findOne({ where: { userId: user.id } });
          if (!existingWorker) {
            await workerRepo.save(workerRepo.create({
              userId: user.id,
              status: WorkerStatus.APPROVED,
            }));
          }
        }

        logger.log(`✅ Created demo account: ${acc.email} (${acc.role})`);
      } else {
        // Ensure active
        // Ensure active and has password
        await userRepo.update(user.id, {
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          passwordHash: defaultPasswordHash,
        });
        logger.log(`✔ Demo account exists: ${acc.email}`);
      }
    }

    logger.log('Demo accounts ready — login with email and password "Password@123" at these emails:');
    logger.log('  mistryjenish1003@gmail.com  → Admin dashboard');
    logger.log('  mistryjenish1234@gmail.com  → Customer dashboard');
    logger.log('  jenscodersindia@gmail.com   → Worker dashboard');
  } catch (e: any) {
    logger.error(`Demo seed failed: ${e.message}`);
  }
}
