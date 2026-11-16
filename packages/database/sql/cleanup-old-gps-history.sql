-- cleanup-old-gps-history.sql
-- Week 8: Optional task for periodic maintenance of GPS location history.
-- Cleans up telemetry points older than 7 days while preserving current_locations.

DELETE FROM location_history
WHERE client_timestamp < NOW() - INTERVAL '7 days';

REINDEX TABLE location_history;
