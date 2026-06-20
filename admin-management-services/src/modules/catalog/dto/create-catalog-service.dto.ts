import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const PRICE_TYPES = ['fixed', 'starting_from', 'hourly'] as const;

export class CreateCatalogServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  availability?: boolean;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsBoolean()
  emergency?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  iconUrl?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  /** Optional display / reference price (₹). Per-vendor booking price is on vendor–service links. */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? null : String(value)))
  @IsString()
  basePrice?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : String(value)))
  @IsIn(PRICE_TYPES)
  priceType?: (typeof PRICE_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? null : String(value).trim()))
  @IsString()
  @MaxLength(64)
  duration?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
