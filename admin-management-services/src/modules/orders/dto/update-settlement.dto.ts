import { IsObject, IsOptional, IsString, IsUUID, MaxLength, IsNumberString } from 'class-validator';

export class UpdateSettlementDto {
  @IsOptional()
  @IsUUID('4')
  vendorId?: string | null;

  @IsOptional()
  @IsUUID('4')
  orderId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  settlementType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  documentUrl?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
