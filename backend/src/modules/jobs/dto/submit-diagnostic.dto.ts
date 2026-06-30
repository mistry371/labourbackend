import {
  IsString, IsNumber, IsBoolean, IsArray,
  IsOptional, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PartDto {
  @IsString() name: string;
  @IsNumber() @Min(0) estimatedCost: number;
}

export class SubmitDiagnosticDto {
  @IsString()
  rootCause: string;

  @IsString()
  recommendedAction: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartDto)
  partsRequired: PartDto[];

  @IsNumber() @Min(0)
  laborCost: number;

  @IsNumber() @Min(0)
  diagnosticFee: number;

  @IsBoolean()
  canBeRemote: boolean;

  @IsNumber() @Min(0)
  estimatedDurationHours: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApprovePriceDto {
  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
