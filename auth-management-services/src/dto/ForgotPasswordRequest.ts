import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordRequest {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email should be valid' })
  email!: string;
}

