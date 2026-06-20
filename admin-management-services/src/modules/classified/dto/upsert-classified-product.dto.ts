import { IsBoolean, IsNumberString, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpsertClassifiedProductDto {
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
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  imageUrls?: string[] | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
