import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateHierarchyNodeDto {
  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nodeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  responsibleUserId?: string | null;

  @IsOptional()
  @IsObject()
  geoZone?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
