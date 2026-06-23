import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class PutVendorDropshippingSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsUUID()
  defaultSupplierId?: string | null;

  @IsOptional()
  @IsBoolean()
  autoForwardOrders?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultMarginPercent?: number;

  @IsOptional()
  @IsBoolean()
  notifyOnStatusChange?: boolean;
}

export class PatchDropshippingOrderStatusDto {
  @IsString()
  status!: string;
}
