import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { VendorKycStatus, VendorStatus } from '../entities/Vendor';

export class CreateVendorDto {
  @IsNotEmpty({ message: 'Business name is required' })
  @IsString()
  @MaxLength(255)
  businessName!: string;

  @IsNotEmpty({ message: 'Owner name is required' })
  @IsString()
  @MaxLength(255)
  ownerName!: string;

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

  @ValidateIf((o) => o.gst != null && String(o.gst).trim() !== '')
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, {
    message: 'GSTIN must be 15 characters in valid format',
  })
  @IsString()
  @MaxLength(64)
  gst?: string | null;

  @ValidateIf((o) => o.pan != null && String(o.pan).trim() !== '')
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, { message: 'PAN must be 10 characters in valid format' })
  @IsString()
  @MaxLength(64)
  pan?: string | null;

  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^(?:\+?91)?[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  @IsString()
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  secondaryPhone?: string | null;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(255)
  email!: string;

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

  /** Required. Also accepts vendorType / vendor_type PRODUCT|SERVICE (normalized in route). */
  @IsNotEmpty({ message: 'Vendor type is required' })
  @IsIn(['product', 'service'], { message: 'Vendor type must be product or service' })
  vendorKind!: 'product' | 'service';
}
