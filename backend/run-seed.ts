import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getDataSourceToken } from '@nestjs/typeorm';
import { seedCategories } from './seed-categories';

async function runSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(getDataSourceToken());
  await seedCategories(dataSource);
  await app.close();
}

runSeed().catch(console.error);
