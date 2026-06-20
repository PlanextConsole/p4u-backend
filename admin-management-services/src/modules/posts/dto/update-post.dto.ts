import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsUUID('4')
  authorCustomerId?: string | null;

  @IsOptional()
  @IsUUID('4')
  authorVendorId?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  mediaJson?: unknown | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
