import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * No-OTP vendor self-registration. The wizard submits business details only;
 * we record a pending vendor_signup_requests row for admin review. No phone
 * verification and no Keycloak user are created here — the vendor proves phone
 * ownership via OTP only at LOGIN, after an admin has approved them.
 */
export class VendorRegisterRequest {
  @IsOptional()
  @IsString()
  vendorKind?: string;

  @IsOptional()
  @IsString()
  vendorType?: string;

  @IsNotEmpty({ message: 'ownerName is required' })
  @IsString()
  @MaxLength(200)
  ownerName!: string;

  @IsNotEmpty({ message: 'businessName is required' })
  @IsString()
  @MaxLength(200)
  businessName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string | null;

  @IsNotEmpty({ message: 'phone is required' })
  @IsString()
  @MaxLength(32)
  phone!: string;

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
