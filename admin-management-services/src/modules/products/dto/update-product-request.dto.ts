import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateProductRequestDto {
  @IsOptional()
  @IsUUID('4')
  vendorId?: string | null;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @IsUUID('4')
  taxConfigurationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown> | null;
}
