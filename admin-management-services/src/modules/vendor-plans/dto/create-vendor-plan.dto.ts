import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVendorPlanDto {
  @IsString()
  @MinLength(2)
  planName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['local', 'vip'])
  planType!: 'local' | 'vip';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(9999)
  tier!: number;

  @Transform(({ value }) => String(value))
  @IsNumberString()
  price!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays!: number;

  @IsIn(['radius', 'city', 'state', 'country'])
  visibilityType!: 'radius' | 'city' | 'state' | 'country';

  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? undefined : String(value)))
  @IsNumberString()
  radiusKm?: string;

  @Transform(({ value }) => String(value))
  @IsNumberString()
  commissionPercent!: string;

  @Transform(({ value }) => String(value))
  @IsNumberString()
  maxUserRedemptionPercent!: string;

  @IsIn(['both', 'online', 'offline'])
  paymentMode!: 'both' | 'online' | 'offline';

  @IsOptional()
  @IsBoolean()
  promoBannerAds?: boolean;

  @IsOptional()
  @IsBoolean()
  promoVideoAds?: boolean;

  @IsOptional()
  @IsBoolean()
  promoPriorityListing?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

