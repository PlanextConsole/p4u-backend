import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerRegisterByPhoneRequest {
  @IsNotEmpty({ message: 'registrationToken is required' })
  @IsString()
  registrationToken!: string;

  @IsNotEmpty({ message: 'fullName is required' })
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  areaLocality?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  pincode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  occupationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customOccupation?: string | null;

  @IsOptional()
  @Type(() => Number)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string | null;
}
