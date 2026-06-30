import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { CategoriesService } from './src/modules/categories/categories.service';
import { ServiceCategory } from './src/modules/categories/entities/service-category.entity';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const categoriesService = app.get(CategoriesService);

  console.log('Seeding new flat catalog...');

  // 1. Wipe existing
  const repo = categoriesService['repo'];
  console.log('Deleting existing categories...');
  await repo.query('DELETE FROM service_categories');

  // 2. Read production JSON
  const catalogPath = path.join(__dirname, 'seed-data', 'production-catalog.json');
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  // 3. Insert Categories and Services
  for (const catData of catalogData) {
    console.log(`Inserting Category: ${catData.name}`);
    
    // Create Root Category
    const category = await repo.save(repo.create({
      name: catData.name,
      slug: catData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icon: catData.icon,
      description: catData.description,
      parent: null,
    }));

    // Create Services
    for (const srvData of catData.services) {
      const srvSlug = srvData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      // Ensure unique slug if duplicate names exist across categories
      const finalSlug = `${category.slug}-${srvSlug}`;
      
      await repo.save(repo.create({
        name: srvData.name,
        slug: finalSlug,
        description: srvData.desc,
        basePrice: srvData.price,
        estimatedDuration: srvData.duration,
        requiredWorkerSkills: srvData.skills,
        requiredTools: srvData.tools,
        emergencyServiceAvailable: srvData.emergency,
        homeVisitAvailable: srvData.homeVisit,
        parent: category,
      }));
    }
  }

  console.log('Catalog seeded successfully!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
