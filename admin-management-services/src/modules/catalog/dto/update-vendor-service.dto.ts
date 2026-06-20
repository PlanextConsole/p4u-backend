import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateVendorServiceDto {
  @IsOptional()
  @Transform(({ value }) => (value == null || value === undefined ? value : String(value)))
  @IsString()
  @MaxLength(32)
  price?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

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
