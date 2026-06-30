import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendPushNotificationDto {
  @IsString()
  @IsIn(['all_users', 'vendors', 'customers', 'riders', 'specific_users'])
  targetAudience!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(512)
  deepLink?: string | null;
}
