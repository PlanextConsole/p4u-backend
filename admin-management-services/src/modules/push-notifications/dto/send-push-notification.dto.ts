import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendPushNotificationDto {
  @IsString()
  @IsIn(['all_users', 'vendors', 'customers'])
  targetAudience!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  deepLink?: string | null;
}
