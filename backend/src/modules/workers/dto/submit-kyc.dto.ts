import { IsString, IsOptional, Matches } from 'class-validator';

export class SubmitKycDto {
  @IsString()
  aadhaarNumber: string;

  @IsString()
  aadhaarFrontUrl: string;

  @IsString()
  aadhaarBackUrl: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  panCardUrl?: string;

  @IsString()
  selfieUrl: string;

  @IsOptional()
  @IsString()
  drivingLicenseNumber?: string;

  @IsOptional()
  @IsString()
  drivingLicenseUrl?: string;

  @IsOptional()
  @IsString()
  policeVerificationUrl?: string;

  @IsString()
  bankAccountNumber: string;

  @IsString()
  bankIfsc: string;

  @IsString()
  bankAccountName: string;
}
