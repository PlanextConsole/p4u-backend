import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePlatformVariableDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  key?: string;

  @IsOptional()
  value?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
