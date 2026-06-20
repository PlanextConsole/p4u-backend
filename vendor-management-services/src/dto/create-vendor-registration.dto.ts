import { IsBoolean, IsEmail, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateVendorRegistrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ownerName?: string;

  @IsOptional()
  @IsNumber()
  age?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  gender?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  secondaryPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  businessType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gst?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  membershipStatus?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  experience?: string | null;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appliedReferralCode?: string | null;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown> | null;

  @IsOptional()
  documents?: unknown | null;

  @IsOptional()
  categories?: unknown | null;

  @IsOptional()
  services?: unknown | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  aboutBusiness?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  commissionRate?: string | null;

  @IsOptional()
  @IsObject()
  bankJson?: Record<string, unknown> | null;
}
