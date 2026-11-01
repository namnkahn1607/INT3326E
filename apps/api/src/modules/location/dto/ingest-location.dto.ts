import { IsString, IsNumber, IsOptional } from 'class-validator';

/**
 * EVT01 / API08 - IngestLocationDto for POST /v1/locations
 * Supports both standard lat/lng and latitude/longitude coordinates.
 * driverId is optional in body as it is derived from the authenticated DRIVER token.
 */
export class IngestLocationDto {
  /** Latitude coordinate (-90 to 90) */
  @IsNumber()
  @IsOptional()
  latitude?: number;

  /** Longitude coordinate (-180 to 180) */
  @IsNumber()
  @IsOptional()
  longitude?: number;

  /** Coordinate alias (lat) */
  @IsNumber()
  @IsOptional()
  lat?: number;

  /** Coordinate alias (lng) */
  @IsNumber()
  @IsOptional()
  lng?: number;

  /** UTC timestamp (Epoch ms or ISO-8601 string) */
  @IsOptional()
  clientTimestamp!: number | string;

  /** Optional session identifier for diagnostics */
  @IsString()
  @IsOptional()
  sessionId?: string;

  /** Optional sequence number within session */
  @IsNumber()
  @IsOptional()
  seq?: number;

  /** Fallback driverId if unauthenticated test */
  @IsString()
  @IsOptional()
  driverId?: string;
}
