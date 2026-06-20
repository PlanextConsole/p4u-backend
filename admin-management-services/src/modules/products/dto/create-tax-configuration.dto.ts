import { IsBoolean, IsNumberString, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaxConfigurationDto {
  @IsString()
  @MaxLength(128)
  code!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsNumberString()
  percentage!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
