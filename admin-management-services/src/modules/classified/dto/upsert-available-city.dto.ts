import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UpsertNameActiveDto } from './upsert-name-active.dto';

export class UpsertAvailableCityDto extends UpsertNameActiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stateName?: string | null;
}
