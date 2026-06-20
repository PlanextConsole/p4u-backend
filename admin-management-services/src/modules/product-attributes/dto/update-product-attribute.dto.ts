import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const ATTR_TYPES = ['select', 'text', 'number'] as const;

export class UpdateProductAttributeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(ATTR_TYPES as unknown as string[])
  type?: (typeof ATTR_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectValues?: string[];
}
