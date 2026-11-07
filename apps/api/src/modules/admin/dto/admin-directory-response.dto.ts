export interface DirectoryPage<T> {
  data: T[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}

export interface DriverResponse {
  id: string;
  name: string;
  activeShipmentCount: number;
  currentLocation: { lat: number; lng: number } | null;
  lastLocationUpdatedAt: string | null;
  locationClientTimestamp: string | null;
  isLocationStale: boolean | null;
}

export interface CustomerSummaryResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}
