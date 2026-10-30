import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ShipmentDetail, StatusEventResponse } from '../../types/shipment-api'
import { shipmentFixture } from '../../features/customer/shipment-fixture'
import { ShipmentLifecycleDetails } from './ShipmentLifecycleDetails'

let root: Root, node: HTMLDivElement
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); node = document.createElement('div'); document.body.append(node); root = createRoot(node) })
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
const event: StatusEventResponse = { id: 'a', shipmentId: shipmentFixture.id, action: 'REASSIGNED',
  fromStatus: 'ASSIGNED', toStatus: 'ASSIGNED', actorRole: 'ADMIN', actorUserId: shipmentFixture.customerId,
  previousDriverId: 'usr_old', newDriverId: 'usr_new', reason: null, occurredAt: shipmentFixture.createdAt }
it('shows server action/audit and ordering without making REASSIGNED a state', async () => {
  const shipment: ShipmentDetail = { ...shipmentFixture, status: 'ASSIGNED', statusHistory: [event, { ...event, id: 'b', action: 'PICKED_UP', toStatus: 'PICKED_UP' }] }
  await act(async () => root.render(<ShipmentLifecycleDetails shipment={shipment} />))
  const events = node.querySelectorAll('li')
  expect(events[0].textContent).toContain('Đã gán lại tài xế')
  expect(events[1].textContent).toContain('Đã lấy hàng')
  expect(node.querySelector('time')?.dateTime).toBe(event.occurredAt)
  expect(node.textContent).toContain(event.actorUserId)
  expect(node.textContent).toContain('usr_old → usr_new')
  expect(node.textContent).not.toContain('REASSIGNED')
})
it('does not invent history and retains failure reason/actor or delivery notes', async () => {
  await act(async () => root.render(<ShipmentLifecycleDetails shipment={{ ...shipmentFixture, status: 'DELIVERY_FAILED',
    failureReason: 'Lý do gốc', failedByRole: 'DRIVER', failedByUserId: 'usr_actor', statusHistory: [] }} />))
  expect(node.querySelector('li')).toBeNull()
  expect(node.textContent).toContain('Chưa có lịch sử')
  expect(node.textContent).toContain('Lý do gốc')
  expect(node.textContent).toContain('Tài xế · usr_actor')
  await act(async () => root.render(<ShipmentLifecycleDetails shipment={{ ...shipmentFixture, status: 'DELIVERED', proofOfDeliveryNotes: 'Đã bàn giao' }} />))
  expect(node.textContent).toContain('Đã bàn giao')
  expect(node.textContent).not.toContain('Lý do gốc')
})
