import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class SignUpRequest {
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  @MinLength(3, { message: 'Username must be between 3 and 50 characters' })
  @MaxLength(50, { message: 'Username must be between 3 and 50 characters' })
  username!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email should be valid' })
  email!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @IsString()
  firstName?: string;

  @IsString()
  lastName?: string;

  @IsNotEmpty({ message: 'User type is required' })
  @IsString()
  userType!: string;

  /** Optional customer referral code (another user's P4U-* or org code) applied at signup. */
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'Referral code is too long' })
  referralCode?: string;

  /**
   * Optional vendor registration details to store alongside vendor signup request.
   * Used by vendor web to capture service/product vendor onboarding info.
   */
  @IsOptional()
  @IsObject()
  vendorPayload?: Record<string, unknown>;
}

