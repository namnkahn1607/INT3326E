import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  evaluateEtaAndFreshness,
  buildShipmentTrackingResponse,
  EARTH_RADIUS_METERS,
} from './eta';
import { Coordinates } from './index';

describe('ETA01 & Tracking Snapshot (TC09.1 - TC09.4 & Week 6/7 Requirements)', () => {
  const coordA: Coordinates = { lat: 21.028511, lng: 105.804817 }; // Hanoi landmark
  const coordB: Coordinates = { lat: 21.033333, lng: 105.844444 }; // Hanoi destination (~4.1km)

  describe('Haversine Formula Math', () => {
    it('TC09.2: should return 0 meters and 0 seconds when coordinates are identical', () => {
      const distance = calculateHaversineDistance(coordA, coordA);
      expect(distance).toBe(0);

      const now = 1761000000000;
      const result = evaluateEtaAndFreshness('PICKED_UP', coordA, new Date(now).toISOString(), coordA, {
        serverNowMs: now,
        speedKmH: 20,
      });

      expect(result.eta).not.toBeNull();
      expect(result.eta!.distanceMeters).toBe(0);
      expect(result.eta!.estimatedSeconds).toBe(0);
      expect(result.eta!.estimatedArrivalAt).toBe(new Date(now).toISOString());
      expect(Number.isFinite(result.eta!.distanceMeters)).toBe(true);
      expect(Number.isFinite(result.eta!.estimatedSeconds)).toBe(true);
      expect(result.etaUnavailableReason).toBeNull();
    });

    it('TC09.1: should accurately compute Haversine distance and ceil estimated seconds with 20 km/h', () => {
      const distance = calculateHaversineDistance(coordA, coordB);
      // Expected distance is approximately 4150-4200 meters
      expect(distance).toBeGreaterThan(4000);
      expect(distance).toBeLessThan(4500);

      const now = 1761000000000;
      const speedKmH = 20;
      const speedMps = (speedKmH * 1000) / 3600; // ~5.5555 m/s
      const expectedSeconds = Math.ceil(distance / speedMps);

      const result = evaluateEtaAndFreshness('PICKED_UP', coordA, new Date(now).toISOString(), coordB, {
        serverNowMs: now,
        speedKmH,
      });

      expect(result.eta).not.toBeNull();
      expect(result.eta!.distanceMeters).toBeCloseTo(distance, 2);
      expect(result.eta!.estimatedSeconds).toBe(expectedSeconds);
      expect(result.eta!.estimatedArrivalAt).toBe(new Date(now + expectedSeconds * 1000).toISOString());
      expect(result.etaUnavailableReason).toBeNull();
      expect(result.isLocationStale).toBe(false);
    });

    it('should clamp intermediate arithmetic parameter without NaN on antipodal or boundary points', () => {
      const northPole: Coordinates = { lat: 90, lng: 0 };
      const southPole: Coordinates = { lat: -90, lng: 0 };
      const antipodalDist = calculateHaversineDistance(northPole, southPole);
      expect(Number.isFinite(antipodalDist)).toBe(true);
      expect(antipodalDist).toBeCloseTo(Math.PI * EARTH_RADIUS_METERS, -2);
    });
  });

  describe('Freshness & Reason Evaluation (TC09.3)', () => {
    const now = 1761000000000;

    it('should evaluate boundary sample ages: 0s, 30s (fresh), 30s + 1ms (stale)', () => {
      // 0s age (exact present)
      const fresh0s = evaluateEtaAndFreshness('PICKED_UP', coordA, new Date(now).toISOString(), coordB, {
        serverNowMs: now,
      });
      expect(fresh0s.isLocationStale).toBe(false);
      expect(fresh0s.eta).not.toBeNull();
      expect(fresh0s.etaUnavailableReason).toBeNull();

      // 30s age (exact boundary)
      const fresh30s = evaluateEtaAndFreshness(
        'PICKED_UP',
        coordA,
        new Date(now - 30000).toISOString(),
        coordB,
        { serverNowMs: now },
      );
      expect(fresh30s.isLocationStale).toBe(false);
      expect(fresh30s.eta).not.toBeNull();
      expect(fresh30s.etaUnavailableReason).toBeNull();

      // 30s + 1ms age (exceeds 30s boundary -> stale)
      const stale30s1ms = evaluateEtaAndFreshness(
        'PICKED_UP',
        coordA,
        new Date(now - 30001).toISOString(),
        coordB,
        { serverNowMs: now },
      );
      expect(stale30s1ms.isLocationStale).toBe(true);
      expect(stale30s1ms.eta).toBeNull();
      expect(stale30s1ms.etaUnavailableReason).toBe('LOCATION_STALE');

      // Future timestamp (clock skew or skew within tolerance) -> age < 0 is not in [0, 30s] -> stale/invalid for ETA
      const futureSample = evaluateEtaAndFreshness(
        'PICKED_UP',
        coordA,
        new Date(now + 5000).toISOString(),
        coordB,
        { serverNowMs: now },
      );
      expect(futureSample.isLocationStale).toBe(true);
      expect(futureSample.eta).toBeNull();
      expect(futureSample.etaUnavailableReason).toBe('LOCATION_STALE');
    });

    it('should return LOCATION_MISSING when current location or timestamp is missing in PICKED_UP', () => {
      const missingCoord = evaluateEtaAndFreshness('PICKED_UP', null, new Date(now).toISOString(), coordB, {
        serverNowMs: now,
      });
      expect(missingCoord.eta).toBeNull();
      expect(missingCoord.etaUnavailableReason).toBe('LOCATION_MISSING');
      expect(missingCoord.isLocationStale).toBeNull();

      const missingTimestamp = evaluateEtaAndFreshness('PICKED_UP', coordA, null, coordB, {
        serverNowMs: now,
      });
      expect(missingTimestamp.eta).toBeNull();
      expect(missingTimestamp.etaUnavailableReason).toBe('LOCATION_MISSING');
    });

    it('should return NOT_PICKED_UP for any shipment state other than PICKED_UP', () => {
      for (const status of ['CREATED', 'ASSIGNED', 'DELIVERED', 'DELIVERY_FAILED'] as const) {
        const res = evaluateEtaAndFreshness(status, coordA, new Date(now).toISOString(), coordB, {
          serverNowMs: now,
        });
        expect(res.eta).toBeNull();
        expect(res.etaUnavailableReason).toBe('NOT_PICKED_UP');
      }
    });
  });

  describe('Invalid Speed Configuration (TC09.4)', () => {
    const now = 1761000000000;

    it('should return CONFIG_INVALID when speed <= 0 or not finite, without modifying deadline or throwing', () => {
      for (const invalidSpeed of [0, -10, NaN, Infinity, -Infinity]) {
        const res = evaluateEtaAndFreshness('PICKED_UP', coordA, new Date(now).toISOString(), coordB, {
          serverNowMs: now,
          speedKmH: invalidSpeed,
        });
        expect(res.eta).toBeNull();
        expect(res.etaUnavailableReason).toBe('CONFIG_INVALID');
        expect(res.isLocationStale).toBe(false);
      }
    });
  });

  describe('Week 6 Terminal and State Visibility Rules (SC05)', () => {
    const now = 1761000000000;
    const baseInput = {
      shipmentId: 'sh_01JK7T6P',
      pickupLocation: { lat: 21.01, lng: 105.81 },
      dropoffLocation: coordB,
      expectedDeliveryAt: '2025-10-21T00:00:00.000Z',
      isLate: false,
    };

    it('should hide driverId, coordinates, timestamps, and ETA for CREATED status', () => {
      const response = buildShipmentTrackingResponse(
        {
          ...baseInput,
          status: 'CREATED',
          driverId: null,
          currentDriverLocation: coordA,
          lastLocationUpdatedAt: new Date(now).toISOString(),
          locationClientTimestamp: new Date(now).toISOString(),
        },
        { serverNowMs: now },
      );

      expect(response.status).toBe('CREATED');
      expect(response.driverId).toBeNull();
      expect(response.currentDriverLocation).toBeNull();
      expect(response.lastLocationUpdatedAt).toBeNull();
      expect(response.locationClientTimestamp).toBeNull();
      expect(response.isLocationStale).toBeNull();
      expect(response.eta).toBeNull();
      expect(response.etaUnavailableReason).toBe('NOT_PICKED_UP');
      expect(response.expectedDeliveryAt).toBe(baseInput.expectedDeliveryAt);
      expect(response.isLate).toBe(false);
    });

    it('should retain driverId but completely hide location, timestamps, and ETA for terminal DELIVERED status', () => {
      const response = buildShipmentTrackingResponse(
        {
          ...baseInput,
          status: 'DELIVERED',
          driverId: 'usr_drv_terminal_01',
          currentDriverLocation: coordA,
          lastLocationUpdatedAt: new Date(now).toISOString(),
          locationClientTimestamp: new Date(now).toISOString(),
        },
        { serverNowMs: now },
      );

      expect(response.status).toBe('DELIVERED');
      expect(response.driverId).toBe('usr_drv_terminal_01'); // Terminal keeps driverId of record
      expect(response.currentDriverLocation).toBeNull();
      expect(response.lastLocationUpdatedAt).toBeNull();
      expect(response.locationClientTimestamp).toBeNull();
      expect(response.isLocationStale).toBeNull();
      expect(response.eta).toBeNull();
      expect(response.etaUnavailableReason).toBe('NOT_PICKED_UP');
    });

    it('should retain driverId but hide location and ETA for terminal DELIVERY_FAILED status', () => {
      const response = buildShipmentTrackingResponse(
        {
          ...baseInput,
          status: 'DELIVERY_FAILED',
          driverId: 'usr_drv_failed_01',
          currentDriverLocation: coordA,
          lastLocationUpdatedAt: new Date(now).toISOString(),
          locationClientTimestamp: new Date(now).toISOString(),
        },
        { serverNowMs: now },
      );

      expect(response.status).toBe('DELIVERY_FAILED');
      expect(response.driverId).toBe('usr_drv_failed_01');
      expect(response.currentDriverLocation).toBeNull();
      expect(response.lastLocationUpdatedAt).toBeNull();
      expect(response.locationClientTimestamp).toBeNull();
      expect(response.isLocationStale).toBeNull();
      expect(response.eta).toBeNull();
      expect(response.etaUnavailableReason).toBe('NOT_PICKED_UP');
    });

    it('should display current location for ASSIGNED status without exposing ETA', () => {
      const response = buildShipmentTrackingResponse(
        {
          ...baseInput,
          status: 'ASSIGNED',
          driverId: 'usr_drv_assigned_01',
          currentDriverLocation: coordA,
          lastLocationUpdatedAt: new Date(now).toISOString(),
          locationClientTimestamp: new Date(now).toISOString(),
        },
        { serverNowMs: now },
      );

      expect(response.status).toBe('ASSIGNED');
      expect(response.driverId).toBe('usr_drv_assigned_01');
      expect(response.currentDriverLocation).toEqual(coordA);
      expect(response.lastLocationUpdatedAt).toBe(new Date(now).toISOString());
      expect(response.locationClientTimestamp).toBe(new Date(now).toISOString());
      expect(response.isLocationStale).toBe(false);
      expect(response.eta).toBeNull();
      expect(response.etaUnavailableReason).toBe('NOT_PICKED_UP');
    });

    it('should display full coordinates and calculate ETA when status is PICKED_UP with fresh GPS', () => {
      const response = buildShipmentTrackingResponse(
        {
          ...baseInput,
          status: 'PICKED_UP',
          driverId: 'usr_drv_picked_01',
          currentDriverLocation: coordA,
          lastLocationUpdatedAt: new Date(now - 5000).toISOString(),
          locationClientTimestamp: new Date(now - 10000).toISOString(),
        },
        { serverNowMs: now, speedKmH: 20 },
      );

      expect(response.status).toBe('PICKED_UP');
      expect(response.driverId).toBe('usr_drv_picked_01');
      expect(response.currentDriverLocation).toEqual(coordA);
      expect(response.isLocationStale).toBe(false);
      expect(response.eta).not.toBeNull();
      expect(response.eta!.distanceMeters).toBeGreaterThan(0);
      expect(response.etaUnavailableReason).toBeNull();
    });
  });
});

