import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateHierarchyNodeDto {
  @IsOptional()
  @IsUUID('4', { message: 'parentId must be a valid UUID' })
  parentId?: string | null;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  nodeType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  responsibleUserId?: string | null;

  @IsOptional()
  @IsObject()
  geoZone?: Record<string, unknown> | null;
}
