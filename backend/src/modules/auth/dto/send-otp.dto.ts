import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendOtpDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  /** Optional — used to personalise the email greeting */
  @IsOptional()
  @IsString()
  name?: string;
}
