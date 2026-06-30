import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(ServiceCategory)
    private readonly repo: Repository<ServiceCategory>,
  ) {}

  async findAll(includeInactive = false): Promise<ServiceCategory[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.repo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findTree(includeInactive = false): Promise<ServiceCategory[]> {
    const where = includeInactive ? { parent: IsNull() } : { parent: IsNull(), isActive: true };
    return this.repo.find({
      where,
      relations: ['children'],
      order: { sortOrder: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ServiceCategory> {
    const cat = await this.repo.findOne({ where: { id }, relations: ['parent', 'children'] });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async findBySlug(slug: string): Promise<ServiceCategory> {
    const cat = await this.repo.findOne({ where: { slug }, relations: ['parent', 'children'] });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(dto: CreateCategoryDto): Promise<ServiceCategory> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    const cat = this.repo.create(dto as any);
    return (this.repo.save(cat) as unknown) as Promise<ServiceCategory>;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<ServiceCategory> {
    const cat = await this.findOne(id);
    if (dto.slug && dto.slug !== cat.slug) {
      const existing = await this.repo.findOne({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Slug already exists');
    }
    Object.assign(cat, dto);
    return this.repo.save(cat);
  }

  async remove(id: string): Promise<void> {
    const cat = await this.findOne(id);
    // Soft delete — just deactivate
    cat.isActive = false;
    await this.repo.save(cat);
  }

  async reorder(items: { id: string; sortOrder: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, sortOrder }) => this.repo.update(id, { sortOrder })),
    );
  }
}
