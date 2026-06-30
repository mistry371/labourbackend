import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PricingRule } from './entities/pricing-rule.entity';
import { UpsertPricingRuleDto } from './dto/upsert-pricing-rule.dto';

/** Default seed data — mirrors the hardcoded values in the AI service */
const DEFAULT_RULES: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { categoryId: 'computer-laptop-services', categoryName: 'Computer & Laptop Services', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'printer-services', categoryName: 'Printer Services', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'networking-services', categoryName: 'Networking Services', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'cctv-security', categoryName: 'CCTV & Security', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'server-cloud', categoryName: 'Server & Cloud', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'email-business-it', categoryName: 'Email & Business IT', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'smart-devices', categoryName: 'Smart Devices', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'office-it-infrastructure', categoryName: 'Office IT Infrastructure', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'cyber-security', categoryName: 'Cyber Security', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'mobile-tablet', categoryName: 'Mobile & Tablet', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'gaming-entertainment', categoryName: 'Gaming & Entertainment', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'smart-home', categoryName: 'Smart Home', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'corporate-enterprise', categoryName: 'Corporate & Enterprise', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'installation-services', categoryName: 'Installation Services', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
  { categoryId: 'maintenance-services', categoryName: 'Maintenance Services', basePrice: 500, minPrice: 200, surgeEnabled: true, maxSurgeFactor: 2.0, isActive: true, notes: null, timeRules: [] },
];

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRule) private ruleRepo: Repository<PricingRule>,
    private httpService: HttpService,
    private config: ConfigService,
  ) {}

  /** Seed defaults if table is empty — called on module init */
  async seedDefaults(): Promise<void> {
    const count = await this.ruleRepo.count();
    if (count > 0) return;
    await this.ruleRepo.save(DEFAULT_RULES.map((r) => this.ruleRepo.create(r)));
  }

  async findAll(): Promise<PricingRule[]> {
    return this.ruleRepo.find({ order: { categoryName: 'ASC' } });
  }

  async findOne(categoryId: string): Promise<PricingRule> {
    const rule = await this.ruleRepo.findOne({ where: { categoryId } });
    if (!rule) throw new NotFoundException(`No pricing rule for category: ${categoryId}`);
    return rule;
  }

  async upsert(dto: UpsertPricingRuleDto): Promise<PricingRule> {
    const existing = await this.ruleRepo.findOne({ where: { categoryId: dto.categoryId } });
    if (existing) {
      await this.ruleRepo.update(existing.id, dto);
      return this.ruleRepo.findOne({ where: { id: existing.id } });
    }
    const rule = this.ruleRepo.create(dto);
    return this.ruleRepo.save(rule);
  }

  async updateOne(id: string, dto: Partial<UpsertPricingRuleDto>): Promise<PricingRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule not found');
    await this.ruleRepo.update(id, dto);
    return this.ruleRepo.findOne({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule not found');
    await this.ruleRepo.delete(id);
  }

  /** Public endpoint consumed by AI service — returns a compact config map */
  async getPublicConfig(): Promise<Record<string, any>> {
    const rules = await this.ruleRepo.find({ where: { isActive: true } });
    const config: Record<string, any> = {};
    for (const r of rules) {
      config[r.categoryId] = {
        basePrice: Number(r.basePrice),
        minPrice: Number(r.minPrice),
        surgeEnabled: r.surgeEnabled,
        maxSurgeFactor: Number(r.maxSurgeFactor),
        timeRules: r.timeRules,
      };
    }
    return config;
  }

  /** Proxy IT diagnostic estimate to AI service */
  async getDiagnosticEstimate(params: {
    categoryId: string; deviceType: string;
    brand?: string; issueType: string; urgency?: string;
  }): Promise<any> {
    try {
      const aiUrl = this.config.get<string>('aiService.baseUrl');
      const response = await firstValueFrom(
        this.httpService.post(`${aiUrl}/api/v1/pricing/diagnostic-estimate`, params, { timeout: 3000 }),
      );
      return response.data;
    } catch {
      // Fallback: return a generic estimate
      return {
        diagnosticFee: 99,
        estimatedRepairRange: { min: 299, max: 1999 },
        commonParts: [],
        estimatedDurationHours: 2,
      };
    }
  }
}
