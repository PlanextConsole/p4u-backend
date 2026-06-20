import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMediaFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['general', 'kyc'])
  kind?: string;
}
