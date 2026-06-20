import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class VendorRegisterByPhoneRequest {
  @IsNotEmpty({ message: 'firebaseIdToken is required' })
  @IsString()
  firebaseIdToken!: string;

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
