-- Tùy chọn: xóa lịch sử GPS cũ hơn 7 ngày, giữ nguyên current_locations.
DELETE FROM location_history
WHERE "clientTimestamp" < now() - interval '7 days';
