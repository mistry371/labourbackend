import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsDateString, Min } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @Min(0)
  discountPercent: number;

  @IsNumber()
  @Min(0)
  discountAmount: number;

  @IsNumber()
  @Min(0)
  maxDiscount: number;

  @IsNumber()
  @Min(0)
  minOrderValue: number;

  @IsDateString()
  expiresAt: string;

  @IsBoolean()
  isActive: boolean;
}
