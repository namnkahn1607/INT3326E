import { apiClient } from '../client'
import type { Shipment } from '../../types/shipment'

export interface CreateShipmentPayload {
  senderName: string
  senderPhone: string
  pickupAddress: string
  pickupLat?: number
  pickupLng?: number
  recipientName: string
  recipientPhone: string
  deliveryAddress: string
  deliveryLat?: number
  deliveryLng?: number
  packageDescription: string
  packageWeightKg: number
}

export async function getShipments(token?: string | null): Promise<Shipment[]> {
  return apiClient<Shipment[]>('/shipments', { token })
}

export async function getShipmentById(id: string, token?: string | null): Promise<Shipment> {
  return apiClient<Shipment>(`/shipments/${id}`, { token })
}

export async function createShipment(
  payload: CreateShipmentPayload,
  token?: string | null
): Promise<Shipment> {
  return apiClient<Shipment>('/shipments', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  })
}
