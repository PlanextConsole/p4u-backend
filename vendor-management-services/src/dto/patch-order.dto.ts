import { IsObject, IsOptional, IsString, IsUUID, MaxLength, IsNumberString } from 'class-validator';

/** Vendor may not reassign order to another vendor (ignored if sent). */
export class PatchVendorOrderDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsNumberString()
  totalAmount?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
