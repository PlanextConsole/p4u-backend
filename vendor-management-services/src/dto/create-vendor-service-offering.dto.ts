import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

const PRICE_TYPES = ['fixed', 'starting_from', 'hourly'] as const;

export class CreateVendorServiceOfferingDto {
  @IsUUID('4')
  serviceId!: string;

  @Transform(({ value }) => (value == null ? '' : String(value).trim()))
  @IsString()
  @MaxLength(32)
  price!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  iconUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsBoolean()
  emergency?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  basePrice?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsIn(PRICE_TYPES)
  priceType?: (typeof PRICE_TYPES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  duration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string | null;
}
