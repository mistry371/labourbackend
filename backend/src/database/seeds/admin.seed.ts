/**
 * Run: npx ts-node -r tsconfig-paths/register src/database/seeds/admin.seed.ts
 * Or add to package.json: "seed:admin": "ts-node -r tsconfig-paths/register src/database/seeds/admin.seed.ts"
 */
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../../modules/users/entities/user.entity';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import * as dotenv from 'dotenv';
dotenv.config();

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    entities: [User, Wallet],
    synchronize: false,
  });

  await ds.initialize();
  const userRepo = ds.getRepository(User);
  const walletRepo = ds.getRepository(Wallet);

  const email = 'mistryjenish1003@gmail.com';
  const existing = await userRepo.findOne({ where: { email } });

  if (existing) {
    console.log('Admin already exists:', existing.email);
    await ds.destroy();
    return;
  }

  const admin = userRepo.create({
    name: 'Jenish Mistry',
    email,
    phone: '9099538970',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
  });
  const saved = await userRepo.save(admin);

  const wallet = walletRepo.create({ userId: saved.id });
  await walletRepo.save(wallet);

  console.log('✅ Admin created:', saved.email, '| ID:', saved.id);
  await ds.destroy();
}

seed().catch(e => { console.error(e); process.exit(1); });
