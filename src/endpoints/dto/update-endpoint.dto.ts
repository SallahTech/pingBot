import {
  IsString,
  IsUrl,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class UpdateEndpointDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  checkInterval?: number;
}
