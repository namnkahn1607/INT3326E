import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * EVT01 - IngestLocationDto for POST /v1/locations
 */
export class IngestLocationDto {
  /** [Bắt buộc] String - Mã định danh tài xế (VD: "drv_123456789") */
  @IsString()
  @IsNotEmpty()
  driverId!: string;

  /** [Bắt buộc] Number (Float) - Tọa độ vĩ độ (VD: 21.028511) */
  @IsNumber()
  latitude!: number;

  /** [Bắt buộc] Number (Float) - Tọa độ kinh độ (VD: 105.804817) */
  @IsNumber()
  longitude!: number;

  /** [Bắt buộc] Number (Integer/Epoch MS) - Thời gian UTC mili-giây (VD: Date.now()) */
  @IsNumber()
  clientTimestamp!: number;

  /** [Tùy chọn] String - Mã phiên di chuyển chẩn đoán (VD: "sess_987654321") */
  @IsString()
  @IsOptional()
  sessionId?: string;

  /** [Tùy chọn] Number (Integer) - Số thứ tự gói tin trong phiên (VD: 1) */
  @IsNumber()
  @IsOptional()
  seq?: number;
}

