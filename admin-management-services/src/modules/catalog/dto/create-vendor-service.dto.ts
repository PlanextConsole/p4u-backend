import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateVendorServiceDto {
  @IsUUID('4')
  vendorId!: string;

  @IsUUID('4')
  serviceId!: string;

  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsString()
  @MaxLength(32)
  price!: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
