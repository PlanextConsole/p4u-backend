import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PhoneExchangeRequest {
  @IsNotEmpty({ message: 'idToken is required' })
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'VENDOR', 'customer', 'vendor'], {
    message: "intendedRole must be 'CUSTOMER' or 'VENDOR'",
  })
  intendedRole?: string;
}
