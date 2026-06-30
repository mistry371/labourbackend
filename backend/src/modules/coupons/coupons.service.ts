import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from './entities/coupon.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon) private couponRepo: Repository<Coupon>,
  ) {}

  async create(dto: CreateCouponDto): Promise<Coupon> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.couponRepo.findOne({ where: { code } });
    if (existing) throw new BadRequestException('Coupon code already exists');

    const coupon = this.couponRepo.create({
      ...dto,
      code,
    });
    return this.couponRepo.save(coupon);
  }

  async validate(dto: ValidateCouponDto): Promise<{
    discount: number;
    finalAmount: number;
    coupon: Coupon;
  }> {
    const code = dto.code.trim().toUpperCase();
    const coupon = await this.couponRepo.findOne({ where: { code, isActive: true } });
    if (!coupon) throw new NotFoundException('Invalid or inactive coupon code');

    if (new Date(coupon.expiresAt) < new Date()) {
      throw new BadRequestException('Coupon code has expired');
    }

    if (dto.orderValue < Number(coupon.minOrderValue)) {
      throw new BadRequestException(`Minimum order value of ₹${coupon.minOrderValue} required`);
    }

    let discount = 0;
    if (Number(coupon.discountPercent) > 0) {
      discount = (dto.orderValue * Number(coupon.discountPercent)) / 100;
      if (Number(coupon.maxDiscount) > 0 && discount > Number(coupon.maxDiscount)) {
        discount = Number(coupon.maxDiscount);
      }
    } else if (Number(coupon.discountAmount) > 0) {
      discount = Number(coupon.discountAmount);
    }

    discount = Math.min(discount, dto.orderValue);
    const finalAmount = dto.orderValue - discount;

    return {
      discount: roundToTwo(discount),
      finalAmount: roundToTwo(finalAmount),
      coupon,
    };
  }

  async findAll(): Promise<Coupon[]> {
    return this.couponRepo.find({ order: { createdAt: 'DESC' } });
  }

  async delete(id: string): Promise<void> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.couponRepo.remove(coupon);
  }
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
