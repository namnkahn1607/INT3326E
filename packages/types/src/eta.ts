import { Coordinates, ShipmentStatus } from './index';

export const EARTH_RADIUS_METERS = 6371000;
export const DEFAULT_SPEED_KMH = 20;
export const STALE_THRESHOLD_MS = 30000; // 30 seconds

export interface EtaDetails {
  distanceMeters: number;
  estimatedSeconds: number;
  estimatedArrivalAt: string; // ISO 8601 UTC
}

export type EtaUnavailableReason =
  | 'NOT_PICKED_UP'
  | 'LOCATION_MISSING'
  | 'LOCATION_STALE'
  | 'CONFIG_INVALID'
  | null;

export interface ShipmentTrackingSnapshotInput {
  shipmentId: string;
  status: ShipmentStatus;
  driverId: string | null;
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  currentDriverLocation: Coordinates | null;
  lastLocationUpdatedAt: string | null;
  locationClientTimestamp: string | null;
  expectedDeliveryAt?: string | null;
  isLate?: boolean | null;
}

export interface ShipmentTrackingResponse {
  shipmentId: string;
  status: ShipmentStatus;
  driverId: string | null;
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  currentDriverLocation: Coordinates | null;
  lastLocationUpdatedAt: string | null;
  locationClientTimestamp: string | null;
  isLocationStale: boolean | null;
  eta: EtaDetails | null;
  etaUnavailableReason: EtaUnavailableReason;
  expectedDeliveryAt: string | null;
  isLate: boolean | null;
}

/**
 * Calculates great-circle distance between two points on Earth using the Haversine formula.
 * Radius: 6,371,000 meters.
 * Clamps intermediate parameter `a` to [0, 1] to prevent arithmetic NaN.
 */
export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  if (coord1.lat === coord2.lat && coord1.lng === coord2.lng) {
    return 0;
  }

  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const lat1Rad = toRad(coord1.lat);
  const lat2Rad = toRad(coord2.lat);
  const dLatRad = toRad(coord2.lat - coord1.lat);
  const dLngRad = toRad(coord2.lng - coord1.lng);

  const sinDLat = Math.sin(dLatRad / 2);
  const sinDLng = Math.sin(dLngRad / 2);

  const a = sinDLat * sinDLat + Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDLng * sinDLng;
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

export interface EtaCalculationOptions {
  speedKmH?: number;
  serverNowMs?: number;
  staleThresholdMs?: number;
}

export interface EtaEvaluationResult {
  eta: EtaDetails | null;
  etaUnavailableReason: EtaUnavailableReason;
  isLocationStale: boolean | null;
}

/**
 * Evaluates ETA01 according to Section 4.9 & 6 of ParcelFlow specification:
 * - Only active PICKED_UP shipments with fresh GPS can compute ETA.
 * - Stale threshold: 30 seconds [0, 30s].
 * - Reasons evaluated in strict order: NOT_PICKED_UP -> LOCATION_MISSING -> LOCATION_STALE -> CONFIG_INVALID.
 */
export function evaluateEtaAndFreshness(
  status: ShipmentStatus,
  currentLocation: Coordinates | null,
  locationClientTimestamp: string | null,
  dropoffLocation: Coordinates,
  options?: EtaCalculationOptions,
): EtaEvaluationResult {
  const serverNowMs = options?.serverNowMs ?? Date.now();
  const speedKmH = options?.speedKmH ?? DEFAULT_SPEED_KMH;
  const staleThresholdMs = options?.staleThresholdMs ?? STALE_THRESHOLD_MS;

  // Terminal or non-PICKED_UP states
  if (status !== 'PICKED_UP') {
    return {
      eta: null,
      etaUnavailableReason: 'NOT_PICKED_UP',
      isLocationStale: null,
    };
  }

  // PICKED_UP check 1: Is current GPS available?
  if (!currentLocation || !locationClientTimestamp) {
    return {
      eta: null,
      etaUnavailableReason: 'LOCATION_MISSING',
      isLocationStale: null,
    };
  }

  const clientTimeMs = Date.parse(locationClientTimestamp);
  if (isNaN(clientTimeMs)) {
    return {
      eta: null,
      etaUnavailableReason: 'LOCATION_MISSING',
      isLocationStale: null,
    };
  }

  // PICKED_UP check 2: Is location fresh? Fresh condition: 0 <= serverNow - clientTime <= 30s
  const sampleAgeMs = serverNowMs - clientTimeMs;
  const isFresh = sampleAgeMs >= 0 && sampleAgeMs <= staleThresholdMs;
  const isLocationStale = !isFresh;

  if (!isFresh) {
    return {
      eta: null,
      etaUnavailableReason: 'LOCATION_STALE',
      isLocationStale: true,
    };
  }

  // PICKED_UP check 3: Is speed configuration positive and finite?
  if (typeof speedKmH !== 'number' || !Number.isFinite(speedKmH) || speedKmH <= 0) {
    return {
      eta: null,
      etaUnavailableReason: 'CONFIG_INVALID',
      isLocationStale: false,
    };
  }

  // All checks passed -> Calculate Haversine distance and arrival time
  const distanceMeters = calculateHaversineDistance(currentLocation, dropoffLocation);
  const speedMps = (speedKmH * 1000) / 3600;
  const estimatedSeconds = distanceMeters === 0 ? 0 : Math.ceil(distanceMeters / speedMps);
  const estimatedArrivalAt = new Date(serverNowMs + estimatedSeconds * 1000).toISOString();

  return {
    eta: {
      distanceMeters,
      estimatedSeconds,
      estimatedArrivalAt,
    },
    etaUnavailableReason: null,
    isLocationStale: false,
  };
}

/**
 * Builds the canonical SC05 tracking response, enforcing terminal and state visibility rules (Week 6):
 * - CREATED: driverId=null, location=null, timestamps=null, stale=null, eta=null
 * - ASSIGNED: driverId=usr_id, location visible (can be stale), eta=null, reason=NOT_PICKED_UP
 * - PICKED_UP: location visible, eta evaluated with fresh GPS condition
 * - DELIVERED / DELIVERY_FAILED (terminal): driverId retained, location=null, timestamps=null, stale=null, eta=null, reason=NOT_PICKED_UP
 */
export function buildShipmentTrackingResponse(
  input: ShipmentTrackingSnapshotInput,
  options?: EtaCalculationOptions,
): ShipmentTrackingResponse {
  const serverNowMs = options?.serverNowMs ?? Date.now();
  const staleThresholdMs = options?.staleThresholdMs ?? STALE_THRESHOLD_MS;

  const isTerminal = input.status === 'DELIVERED' || input.status === 'DELIVERY_FAILED';
  const isCreated = input.status === 'CREATED';

  // Terminal and CREATED shipments hide driver coordinates and timestamps
  if (isTerminal || isCreated) {
    return {
      shipmentId: input.shipmentId,
      status: input.status,
      driverId: isCreated ? null : input.driverId,
      pickupLocation: input.pickupLocation,
      dropoffLocation: input.dropoffLocation,
      currentDriverLocation: null,
      lastLocationUpdatedAt: null,
      locationClientTimestamp: null,
      isLocationStale: null,
      eta: null,
      etaUnavailableReason: 'NOT_PICKED_UP',
      expectedDeliveryAt: input.expectedDeliveryAt ?? null,
      isLate: input.isLate ?? null,
    };
  }

  // Active status with assigned driver (ASSIGNED or PICKED_UP)
  let isLocationStale: boolean | null = null;
  if (input.currentDriverLocation && input.locationClientTimestamp) {
    const clientTimeMs = Date.parse(input.locationClientTimestamp);
    if (!isNaN(clientTimeMs)) {
      const ageMs = serverNowMs - clientTimeMs;
      isLocationStale = ageMs < 0 || ageMs > staleThresholdMs;
    }
  }

  const { eta, etaUnavailableReason } = evaluateEtaAndFreshness(
    input.status,
    input.currentDriverLocation,
    input.locationClientTimestamp,
    input.dropoffLocation,
    options,
  );

  return {
    shipmentId: input.shipmentId,
    status: input.status,
    driverId: input.driverId,
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation,
    currentDriverLocation: input.currentDriverLocation,
    lastLocationUpdatedAt: input.lastLocationUpdatedAt,
    locationClientTimestamp: input.locationClientTimestamp,
    isLocationStale,
    eta,
    etaUnavailableReason,
    expectedDeliveryAt: input.expectedDeliveryAt ?? null,
    isLate: input.isLate ?? null,
  };
}

