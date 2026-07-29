import { IsEmail, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * No-OTP vendor self-registration. Every profile field is optional at this
 * stage; admin can request or complete missing information during review.
 */
export class VendorRegisterRequest {
  @IsOptional()
  @IsString()
  vendorKind?: string;

  @IsOptional()
  @IsString()
  vendorType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  businessType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  secondaryPhone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gst?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pan?: string | null;

  @IsOptional()
  categoriesJson?: unknown;

  @IsOptional()
  servicesJson?: unknown;

  @IsOptional()
  @IsObject()
  addressJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  documentsJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  bankJson?: Record<string, unknown> | null;
}