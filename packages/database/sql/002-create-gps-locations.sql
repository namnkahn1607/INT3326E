-- DATA04 current_locations và DATA05 location_history (đặc tả v1.4, Phần VI mục 7.4–7.5).
-- Chạy sau 001-create-shipment.sql vì cần bảng users. Worker ghi, API chỉ đọc.
BEGIN;

CREATE TABLE location_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "driverId" text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  "clientTimestamp" timestamptz(3) NOT NULL,
  "receivedAt" timestamptz(3) NOT NULL,
  "eventId" text NOT NULL,
  "sessionId" uuid,
  seq integer,
  "persistedAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  -- Khóa chống trùng: mẫu đầu tiên thắng. Index của UNIQUE này dùng được cho cả truy vấn
  -- theo "clientTimestamp" giảm dần, nên không tạo thêm index DESC riêng.
  CONSTRAINT location_history_driver_client_ts UNIQUE ("driverId", "clientTimestamp")
);

-- Dọn history theo mốc 7 ngày tính từ "persistedAt".
CREATE INDEX location_history_persisted_at ON location_history ("persistedAt");

CREATE TABLE current_locations (
  "driverId" text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  "clientTimestamp" timestamptz(3) NOT NULL,
  "receivedAt" timestamptz(3) NOT NULL,
  "eventId" text NOT NULL,
  "sessionId" uuid,
  seq integer,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);

COMMIT;
