import { IsBoolean, IsNumberString, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateVendorOrganizationOrderDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsBoolean()
  isClaimed?: boolean;

  @IsOptional()
  @IsNumberString()
  totalAmount?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
