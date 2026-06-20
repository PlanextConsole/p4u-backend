import { IsBoolean, IsEmail, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { VendorKycStatus, VendorStatus } from '../entities/Vendor';

export class UpdateVendorDto {
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
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  secondaryPhone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  membershipStatus?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: VendorStatus;

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
  @IsString()
  @MaxLength(32)
  kycStatus?: VendorKycStatus;

  @IsOptional()
  categoriesJson?: unknown | null;

  @IsOptional()
  servicesJson?: unknown | null;

  @IsOptional()
  @IsObject()
  addressJson?: Record<string, unknown> | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  commissionRate?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  maxRedemptionPercent?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  vendorPlanId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  enrollmentCost?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  coverageRadiusKm?: string | null;

  @IsOptional()
  @IsIn(['district', 'state', 'pan_india', 'international'])
  restriction?: string | null;

  @IsOptional()
  @IsBoolean()
  selfDelivery?: boolean;

  @IsOptional()
  @IsObject()
  documentsJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  bankJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  keycloakUserId?: string | null;

  @IsOptional()
  @IsIn(['product', 'service'])
  vendorKind?: 'product' | 'service';
}
