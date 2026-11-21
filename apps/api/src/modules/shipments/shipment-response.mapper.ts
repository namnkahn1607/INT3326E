import { ServiceUnavailableException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { Coordinates, EtaDetails, EtaUnavailableReason, ShipmentTrackingResponse } from '../location/dto/tracking-response.dto';
import { BUSINESS_USER_ID, SHIPMENT_ID } from './dto/shipment-list-query';
import { SHIPMENT_STATUSES, type ShipmentResponseDto, type ShipmentStatus } from './dto/shipment-response.dto';

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_SPEED_KMH = 20;
const STALE_THRESHOLD_MS = 30000;

export interface ShipmentRow extends QueryResultRow {
  id: string; trackingCode: string; senderId: string; driverId: string | null; status: ShipmentStatus;
  pickupAddress: string; pickupLat: number; pickupLng: number;
  deliveryAddress: string; deliveryLat: number; deliveryLng: number;
  recipientName: string; recipientPhone: string; notes: string | null;
  packageDescription: string | null; packageWeightKg: number | null; expectedDeliveryAt: Date | null;
  failureReason: string | null; failedByRole: 'DRIVER' | 'ADMIN' | null; failedByUserId: string | null;
  proofOfDeliveryNotes: string | null; createdAt: Date; updatedAt: Date;
  cursorCreatedAt: string; observedAt: Date; terminalAt: Date | null;
}

export interface ShipmentTrackingRow extends ShipmentRow {
  locationDriverId: string | null;
  currentLat: number | null;
  currentLng: number | null;
  locationClientTimestamp: Date | null;
  lastLocationUpdatedAt: Date | null;
}

// Đơn đã kết thúc: tính giao trễ theo sự kiện kết thúc, tránh đổi kết quả khi đọc lại sau đó.
export const SHIPMENT_PROJECTION = `s.*,
  to_char(s."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorCreatedAt",
  statement_timestamp() AS "observedAt",
  (SELECT e."occurredAt" FROM shipment_status_events e
   WHERE e."shipmentId" = s.id AND e.action::text = s.status::text AND e."toStatus"::text = s.status::text
     AND e.action IN ('DELIVERED', 'DELIVERY_FAILED')
   ORDER BY e."occurredAt", e.id LIMIT 1) AS "terminalAt"`;

const iso = (value: Date) => new Date(value).toISOString();

function validCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function validateShipmentRow(row: ShipmentRow) {
  const terminal = row.status === 'DELIVERED' || row.status === 'DELIVERY_FAILED';
  const observedAtMs = new Date(row.observedAt).getTime();
  if (!SHIPMENT_ID.test(row.id) || !BUSINESS_USER_ID.test(row.senderId) ||
      !SHIPMENT_STATUSES.includes(row.status) || (row.status === 'CREATED') !== (row.driverId === null) ||
      (row.driverId !== null && !BUSINESS_USER_ID.test(row.driverId)) || (terminal && !row.terminalAt) ||
      !validCoordinates(row.pickupLat, row.pickupLng) || !validCoordinates(row.deliveryLat, row.deliveryLng) ||
      !Number.isFinite(observedAtMs)) {
    throw new ServiceUnavailableException();
  }
  const comparisonTime = terminal ? row.terminalAt! : row.observedAt;
  const expectedDeliveryAt = row.expectedDeliveryAt === null ? null : iso(row.expectedDeliveryAt);
  const isLate = row.expectedDeliveryAt === null
    ? null
    : new Date(comparisonTime).getTime() > new Date(row.expectedDeliveryAt).getTime();
  return { terminal, observedAtMs, expectedDeliveryAt, isLate };
}

function haversineDistanceMeters(coord1: Coordinates, coord2: Coordinates): number {
  if (coord1.lat === coord2.lat && coord1.lng === coord2.lng) return 0;
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const sinDLat = Math.sin(toRad(coord2.lat - coord1.lat) / 2);
  const sinDLng = Math.sin(toRad(coord2.lng - coord1.lng) / 2);
  const a = sinDLat * sinDLat + Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * sinDLng * sinDLng;
  const clampedA = Math.min(1, Math.max(0, a));
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
}

export function shipmentResponse(row: ShipmentRow): ShipmentResponseDto {
  const { expectedDeliveryAt, isLate } = validateShipmentRow(row);
  // Ánh xạ rõ từng trường để response đúng contract và không lộ cột nội bộ của database.
  return {
    id: row.id, trackingNumber: row.trackingCode, customerId: row.senderId, driverId: row.driverId, status: row.status,
    pickupAddress: row.pickupAddress, pickupLocation: { lat: row.pickupLat, lng: row.pickupLng },
    dropoffAddress: row.deliveryAddress, dropoffLocation: { lat: row.deliveryLat, lng: row.deliveryLng },
    recipientName: row.recipientName, recipientPhone: row.recipientPhone, notes: row.notes,
    packageDescription: row.packageDescription, packageWeightKg: row.packageWeightKg,
    expectedDeliveryAt, isLate,
    failureReason: row.failureReason, failedByRole: row.failedByRole, failedByUserId: row.failedByUserId,
    proofOfDeliveryNotes: row.proofOfDeliveryNotes, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  };
}

export function shipmentTrackingResponse(row: ShipmentTrackingRow): ShipmentTrackingResponse {
  const { terminal, observedAtMs, expectedDeliveryAt, isLate } = validateShipmentRow(row);
  if (row.locationDriverId === null) {
    if (row.currentLat !== null || row.currentLng !== null ||
        row.locationClientTimestamp !== null || row.lastLocationUpdatedAt !== null) {
      throw new ServiceUnavailableException();
    }
  } else {
    if (row.locationDriverId !== row.driverId ||
        !validCoordinates(row.currentLat, row.currentLng) ||
        row.locationClientTimestamp === null || row.lastLocationUpdatedAt === null) {
      throw new ServiceUnavailableException();
    }
    const clientMs = new Date(row.locationClientTimestamp).getTime();
    const receivedMs = new Date(row.lastLocationUpdatedAt).getTime();
    if (!Number.isFinite(clientMs) || !Number.isFinite(receivedMs) || clientMs > receivedMs) {
      throw new ServiceUnavailableException();
    }
  }

  const pickupLocation: Coordinates = { lat: row.pickupLat, lng: row.pickupLng };
  const dropoffLocation: Coordinates = { lat: row.deliveryLat, lng: row.deliveryLng };

  if (row.status === 'CREATED' || terminal) {
    return {
      shipmentId: row.id,
      status: row.status,
      driverId: row.status === 'CREATED' ? null : row.driverId,
      pickupLocation,
      dropoffLocation,
      currentDriverLocation: null,
      lastLocationUpdatedAt: null,
      locationClientTimestamp: null,
      isLocationStale: null,
      eta: null,
      etaUnavailableReason: 'NOT_PICKED_UP',
      expectedDeliveryAt,
      isLate,
    };
  }

  if (row.locationDriverId === null) {
    return {
      shipmentId: row.id,
      status: row.status,
      driverId: row.driverId,
      pickupLocation,
      dropoffLocation,
      currentDriverLocation: null,
      lastLocationUpdatedAt: null,
      locationClientTimestamp: null,
      isLocationStale: null,
      eta: null,
      etaUnavailableReason: row.status === 'ASSIGNED' ? 'NOT_PICKED_UP' : 'LOCATION_MISSING',
      expectedDeliveryAt,
      isLate,
    };
  }

  const currentDriverLocation: Coordinates = { lat: row.currentLat!, lng: row.currentLng! };
  const lastLocationUpdatedAt = iso(row.lastLocationUpdatedAt!);
  const locationClientTimestamp = iso(row.locationClientTimestamp!);
  const ageMs = observedAtMs - Date.parse(locationClientTimestamp);
  const isLocationStale = ageMs < 0 || ageMs > STALE_THRESHOLD_MS;

  let eta: EtaDetails | null = null;
  let etaUnavailableReason: EtaUnavailableReason = 'NOT_PICKED_UP';
  if (row.status === 'PICKED_UP') {
    if (isLocationStale) {
      etaUnavailableReason = 'LOCATION_STALE';
    } else {
      const distanceMeters = haversineDistanceMeters(currentDriverLocation, dropoffLocation);
      const speedMps = (DEFAULT_SPEED_KMH * 1000) / 3600;
      const estimatedSeconds = distanceMeters === 0 ? 0 : Math.ceil(distanceMeters / speedMps);
      eta = {
        distanceMeters,
        estimatedSeconds,
        estimatedArrivalAt: new Date(observedAtMs + estimatedSeconds * 1000).toISOString(),
      };
      etaUnavailableReason = null;
    }
  }

  return {
    shipmentId: row.id,
    status: row.status,
    driverId: row.driverId,
    pickupLocation,
    dropoffLocation,
    currentDriverLocation,
    lastLocationUpdatedAt,
    locationClientTimestamp,
    isLocationStale,
    eta,
    etaUnavailableReason,
    expectedDeliveryAt,
    isLate,
  };
}
