import { IsBoolean, IsEmail, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class PatchVendorProfileDto {
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
  @IsString()
  @MaxLength(512)
  thumbnailUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  bannerUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gst?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pan?: string | null;

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
  @IsString()
  aboutBusiness?: string | null;

  @IsOptional()
  @IsObject()
  addressJson?: Record<string, unknown> | null;

  @IsOptional()
  categoriesJson?: unknown;

  @IsOptional()
  servicesJson?: unknown;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  commissionRate?: string | null;

  @IsOptional()
  @IsObject()
  documentsJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  bankJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
