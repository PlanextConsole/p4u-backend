import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumberString, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  availability?: boolean;

  @IsOptional()
  @IsUUID('4')
  vendorId?: string | null;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @IsUUID('4')
  serviceId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  sellPrice?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  discountAmount?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  finalPrice?: string;

  @IsOptional()
  @IsUUID('4')
  taxConfigurationId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  longDescription?: string | null;

  @IsOptional()
  @IsString()
  promiseP4u?: string | null;

  @IsOptional()
  @IsString()
  helpLineNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  thumbnailUrl?: string | null;

  @IsOptional()
  @IsArray()
  bannerUrls?: string[] | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  commissionOverridePercent?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'approved', 'rejected'])
  moderationStatus?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
