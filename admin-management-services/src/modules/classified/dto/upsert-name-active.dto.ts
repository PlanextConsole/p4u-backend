import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertNameActiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
