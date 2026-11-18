BEGIN TRANSACTION READ ONLY;

-- Mẫu cuối đã được UI và response 202 xác nhận trong lượt kiểm 17/11 buổi tối.
SELECT * FROM location_history
WHERE "eventId" = 'evt_3de4d199-19ac-444d-8779-5f93382eddaf';

-- Mẫu cuối seq 17 là future theo receivedAt gốc; current hợp lệ sau replay là seq 11.
SELECT * FROM current_locations
WHERE "driverId" = 'usr_01M5SW7617KAKAMEE4G0W50HRX';

-- Đối chiếu mẫu hiện hành với đúng bản ghi history, kể cả khi mẫu cuối chỉ vào history.
SELECT h.* FROM location_history h
JOIN current_locations c ON c."driverId" = h."driverId" AND c."eventId" = h."eventId"
WHERE c."driverId" = 'usr_01M5SW7617KAKAMEE4G0W50HRX';

SELECT count(*) AS "historyRows", count(DISTINCT "clientTimestamp") AS "distinctTimestamps",
       min(seq) AS "firstSeq", max(seq) AS "lastSeq"
FROM location_history
WHERE "driverId" = 'usr_01M5SW7617KAKAMEE4G0W50HRX'
  AND "clientTimestamp" BETWEEN '2026-11-17T14:51:22.709Z' AND '2026-11-17T14:53:30.708Z';

COMMIT;
