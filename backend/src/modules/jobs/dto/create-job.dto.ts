import {
  IsString, IsNotEmpty, IsNumber, IsOptional,
  IsArray, IsDateString, Length, Min, Max,
  IsEnum, IsBoolean, IsObject, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType, ServiceMode } from '../entities/job-status.enum';

export class ItAttributesDto {
  @IsOptional() @IsString() deviceType?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() issueType?: string;
  @IsOptional() @IsString() issueDescription?: string;
  @IsOptional() @IsString() urgency?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsNumber() purchaseYear?: number;
  @IsOptional() @IsString() warrantyStatus?: string;
  @IsOptional() @IsBoolean() remoteAccessAvailable?: boolean;
  @IsOptional() @IsString() preferredTime?: string;
}

export class CreateJobDto {
  @IsString()
  @Length(5, 200)
  title: string;

  @IsString()
  @Length(10, 2000)
  description: string;

  @IsString()
  categoryId: string;

  @IsString()
  categoryName: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsNumber()
  @Min(0)
  estimatedPrice: number;

  @IsString()
  jobAddress: string;

  @IsNumber()
  @Min(-90) @Max(90)
  jobLatitude: number;

  @IsNumber()
  @Min(-180) @Max(180)
  jobLongitude: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  // IT extension fields
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsEnum(ServiceMode)
  serviceMode?: ServiceMode;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ItAttributesDto)
  itAttributes?: ItAttributesDto;
}
