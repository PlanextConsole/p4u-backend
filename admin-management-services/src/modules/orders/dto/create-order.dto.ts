import { IsObject, IsOptional, IsString, IsUUID, MaxLength, IsNumberString } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsUUID('4')
  vendorId?: string | null;

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
