import type {
  Coordinates,
  ShipmentStatus,
  EtaDetails,
  EtaUnavailableReason,
  ShipmentTrackingResponse,
} from '@parcelflow/types';

export type {
  Coordinates,
  ShipmentStatus,
  EtaDetails,
  EtaUnavailableReason,
  ShipmentTrackingResponse,
};

export class ShipmentTrackingResponseDto implements ShipmentTrackingResponse {
  shipmentId!: string;
  status!: ShipmentStatus;
  driverId!: string | null;
  pickupLocation!: Coordinates;
  dropoffLocation!: Coordinates;
  currentDriverLocation!: Coordinates | null;
  lastLocationUpdatedAt!: string | null;
  locationClientTimestamp!: string | null;
  isLocationStale!: boolean | null;
  eta!: EtaDetails | null;
  etaUnavailableReason!: EtaUnavailableReason;
  expectedDeliveryAt!: string | null;
  isLate!: boolean | null;
}

