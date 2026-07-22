import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PhoneExchangeRequest {
  @IsNotEmpty({ message: 'idToken is required' })
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'VENDOR', 'RIDER', 'customer', 'vendor', 'rider'], {
    message: "intendedRole must be 'CUSTOMER', 'VENDOR' or 'RIDER'",
  })
  intendedRole?: string;
}
