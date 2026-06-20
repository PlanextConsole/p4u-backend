import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAppLayoutDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  screenKey!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  displayName!: string;

  @IsArray()
  widgetConfig!: unknown[];

  @IsOptional()
  @IsObject()
  targetingRules?: Record<string, unknown> | null;

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
