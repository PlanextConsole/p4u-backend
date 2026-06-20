import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWebsiteQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  resolvedBy?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
