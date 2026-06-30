import {
  IsString, IsNumber, IsBoolean, IsOptional, IsArray,
  ValidateNested, Min, Max, IsInt, Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TimeRuleDto {
  @IsString()
  label: string;

  @IsInt() @Min(0) @Max(23)
  startHour: number;

  @IsInt() @Min(0) @Max(23)
  endHour: number;

  @IsArray() @IsInt({ each: true })
  days: number[];

  @IsNumber() @Min(0.5) @Max(5)
  multiplier: number;

  @IsBoolean()
  enabled: boolean;
}

export class UpsertPricingRuleDto {
  @IsString() @Length(1, 100)
  categoryId: string;

  @IsString() @Length(1, 100)
  categoryName: string;

  @IsNumber() @Min(0)
  basePrice: number;

  @IsNumber() @Min(0)
  minPrice: number;

  @IsBoolean()
  surgeEnabled: boolean;

  @IsNumber() @Min(1) @Max(10)
  maxSurgeFactor: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeRuleDto)
  timeRules: TimeRuleDto[];

  @IsBoolean()
  isActive: boolean;

  @IsOptional() @IsString()
  notes?: string;
}
