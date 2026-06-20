import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePlatformVariableDto {
  @IsString()
  @MaxLength(128)
  key!: string;

  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
