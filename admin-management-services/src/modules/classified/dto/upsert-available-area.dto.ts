import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { UpsertNameActiveDto } from './upsert-name-active.dto';

export class UpsertAvailableAreaDto extends UpsertNameActiveDto {
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string | null;
}
