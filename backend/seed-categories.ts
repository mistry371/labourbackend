import { DataSource } from 'typeorm';
import { ServiceCategory, CatalogLevel } from './src/modules/categories/entities/service-category.entity';

export async function seedCategories(dataSource: DataSource) {
  const repo = dataSource.getRepository(ServiceCategory);

  // Clear existing
  await repo.query('DELETE FROM service_categories');

  // Level 1: Category
  const computerCat = repo.create({
    name: 'Computer & Laptop',
    slug: 'computer-laptop',
    icon: '💻',
    description: 'Computer and Laptop Services',
    basePrice: 0,
    catalogLevel: CatalogLevel.CATEGORY,
    isActive: true,
  });
  await repo.save(computerCat);

  // Level 2: Device
  const laptopDevice = repo.create({
    name: 'Laptop',
    slug: 'computer-laptop-laptop',
    icon: '💻',
    description: 'Laptop Device',
    basePrice: 0,
    catalogLevel: CatalogLevel.DEVICE,
    parent: computerCat,
    isActive: true,
  });
  await repo.save(laptopDevice);

  // Level 3: Service Type
  const repairType = repo.create({
    name: 'Repair',
    slug: 'computer-laptop-laptop-repair',
    icon: '🔧',
    description: 'Repair Services',
    basePrice: 0,
    catalogLevel: CatalogLevel.SERVICE_TYPE,
    parent: laptopDevice,
    isActive: true,
  });
  await repo.save(repairType);

  // Level 4: Problem
  const notTurningOn = repo.create({
    name: 'Not Turning On',
    slug: 'computer-laptop-laptop-repair-not-turning-on',
    icon: '⚠️',
    description: 'Device is not powering on',
    basePrice: 500,
    catalogLevel: CatalogLevel.PROBLEM,
    parent: repairType,
    isActive: true,
  });
  await repo.save(notTurningOn);

  console.log('Successfully seeded 4-level categories!');
}
