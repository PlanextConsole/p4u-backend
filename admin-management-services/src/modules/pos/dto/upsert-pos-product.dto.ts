import { IsBoolean, IsNumberString, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpsertPosProductDto {
  @IsOptional()
  @IsUUID('4')
  vendorId?: string | null;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
