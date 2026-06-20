import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateObjectionableLogDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reasonCode?: string | null;

  @IsOptional()
  @IsString()
  reviewNotes?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
