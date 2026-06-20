import { ArrayMinSize, IsArray, IsString, Length } from 'class-validator';

export class B2ImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keys!: string[];

  @IsString()
  @Length(36, 36)
  folderId!: string;
}
