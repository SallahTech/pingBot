import { IsString, IsUrl, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateEndpointDto {
  @IsUrl({ require_protocol: true })
  url: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  checkInterval?: number;
}
