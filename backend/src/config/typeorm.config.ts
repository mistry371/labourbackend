import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getTypeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => {
  const isProduction = config.get('nodeEnv') === 'production';

  // Railway (and most PaaS) provide DATABASE_URL — use it if available
  const databaseUrl = process.env.DATABASE_URL;

  const base: Partial<TypeOrmModuleOptions> = {
    type: 'postgres',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: true,
    logging: !isProduction,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    extra: {
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  };

  if (databaseUrl) {
    return { ...base, url: databaseUrl } as TypeOrmModuleOptions;
  }

  return {
    ...base,
    host: config.get('database.host'),
    port: config.get('database.port'),
    username: config.get('database.username'),
    password: config.get('database.password'),
    database: config.get('database.name'),
  } as TypeOrmModuleOptions;
};
