import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PricingModel } from '../entities/service-category.entity';

export class FormFieldDto {
  @IsString() key: string;
  @IsString() label: string;
  @IsIn(['text','number','select','multiselect','textarea','boolean','file','range']) type: string;
  @IsBoolean() required: boolean;
  @IsOptional() @IsString() placeholder?: string;
  @IsOptional() options?: { label: string; value: string }[];
  @IsOptional() @IsNumber() min?: number;
  @IsOptional() @IsNumber() max?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() helpText?: string;
}

export class CreateCategoryDto {
  @IsString() name: string;
  @IsString() slug: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsEnum(PricingModel) pricingModel?: PricingModel;
  @IsOptional() @IsNumber() basePrice?: number;
  @IsOptional() @IsNumber() minPrice?: number;
  @IsOptional() @IsNumber() maxPrice?: number;
  @IsOptional() @IsString() priceUnit?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldDto) formSchema?: FormFieldDto[];
  @IsOptional() @IsString() metaTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() metadata?: Record<string, any>;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
