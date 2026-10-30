import type { TrackingData } from '../../api/endpoints/tracking'
import { shipmentFixture } from '../../features/customer/shipment-fixture'

export function trackingFixture(change: Partial<TrackingData> = {}): TrackingData {
  const time = new Date().toISOString()
  return { shipmentId: shipmentFixture.id, status: 'PICKED_UP', driverId: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX',
    pickupLocation: { lat: 21.0285, lng: 105.8342 }, dropoffLocation: { lat: 21.0368, lng: 105.7827 },
    currentDriverLocation: { lat: 21.03, lng: 105.81 }, lastLocationUpdatedAt: time, locationClientTimestamp: time,
    isLocationStale: false, eta: null, etaUnavailableReason: 'CONFIG_INVALID', expectedDeliveryAt: null, isLate: null, ...change }
}
