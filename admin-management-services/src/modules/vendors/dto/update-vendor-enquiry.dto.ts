import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateVendorEnquiryDto {
  @IsOptional()
  @IsUUID('4')
  vendorId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  message?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  workflowStage?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
