import { apiClient } from '../client'
import type { Shipment } from '../../types/shipment'

export interface AssignDriverPayload {
  driverId: string
}

export async function getUnassignedShipments(token?: string | null): Promise<Shipment[]> {
  return apiClient<Shipment[]>('/shipments/unassigned', { token })
}

export async function assignShipmentDriver(
  shipmentId: string,
  payload: AssignDriverPayload,
  token?: string | null
): Promise<Shipment> {
  return apiClient<Shipment>(`/shipments/${shipmentId}/assign`, {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  })
}
