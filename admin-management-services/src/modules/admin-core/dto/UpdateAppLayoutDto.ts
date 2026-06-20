import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';

export class UpdateAppLayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  screenKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsArray()
  widgetConfig?: unknown[];

  @IsOptional()
  @IsObject()
  targetingRules?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @IsOptional()
  @IsDateString()
  validTo?: string | null;
}
