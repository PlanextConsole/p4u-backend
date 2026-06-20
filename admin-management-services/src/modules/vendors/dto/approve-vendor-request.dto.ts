import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveVendorRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  keycloakUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  notes?: string | null;
}
