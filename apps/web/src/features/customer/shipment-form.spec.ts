import { describe, expect, it } from 'vitest'
import { emptyShipmentDraft, validateShipmentDraft, canRetryIntent, classifyCreateFailure } from './shipment-form'
import { ApiError } from '../../api/client'

const valid = { ...emptyShipmentDraft, pickupAddress: ' 144 Xuan Thuy ', pickupLat: '0', pickupLng: '0',
  dropoffAddress: '1 Dai Co Viet', dropoffLat: '21', dropoffLng: '105',
  recipientName: 'Nguoi nhan', recipientPhone: '+84901234567', senderName: 'Nguoi gui', senderPhone: '0901234567' }

describe('Create form normalization', () => {
  it.each([
    [new ApiError(404, 'RESOURCE_NOT_FOUND'), 'unavailable'],
    [new ApiError(401, 'UNAUTHENTICATED'), 'auth'],
    [new ApiError(0, 'NETWORK_ERROR'), 'uncertain'],
    [new ApiError(503, 'UNAVAILABLE'), 'uncertain'],
    [new ApiError(200, 'INVALID_RESPONSE'), 'uncertain'],
    [new ApiError(400, 'VALIDATION_ERROR'), 'rejected'],
    [new ApiError(403, 'FORBIDDEN'), 'rejected'],
    [new Error('Disconnected'), 'uncertain'],
  ])('classifies create failure %s without changing retry policy', (error, expected) => {
    expect(classifyCreateFailure(error)).toBe(expected)
  })
  it('counts Unicode characters consistently with backend and PostgreSQL limits', () => {
    const result = validateShipmentDraft({ ...valid, recipientName: '😀'.repeat(100), notes: '📦'.repeat(500) })
    expect(result.errors).toEqual({})
    expect(validateShipmentDraft({ ...valid, notes: '📦'.repeat(501) }).errors).toHaveProperty('notes')
  })
  it('retains coordinate zero and sends no actor or legacy fields', () => {
    const result = validateShipmentDraft(valid)
    expect(result.errors).toEqual({})
    expect(result.payload).toEqual({ pickupAddress: '144 Xuan Thuy', pickupLocation: { lat: 0, lng: 0 },
      dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 21, lng: 105 },
      recipientName: 'Nguoi nhan', recipientPhone: '+84901234567' })
  })
  it('composes the full shipping address without adding UI-only fields to the API payload', () => {
    const result = validateShipmentDraft({ ...valid, pickupAddress: 'Duong Xuan Thuy', pickupArea: 'Ha Noi', pickupDetails: 'So 144, tang 2' })
    expect(result.errors).toEqual({})
    expect(result.payload.pickupAddress).toBe('So 144, tang 2, Duong Xuan Thuy, Ha Noi')
    expect(result.payload).not.toHaveProperty('pickupArea')
    expect(result.payload).not.toHaveProperty('pickupDetails')
  })
  it('checks the combined address length against the API contract', () => {
    const result = validateShipmentDraft({ ...valid, pickupAddress: 'a'.repeat(200), pickupArea: 'b'.repeat(100) })
    expect(result.errors.pickupAddress).toContain('255')
  })
  it('validates the composed address rather than rejecting short street names with a valid area', () => {
    const result = validateShipmentDraft({ ...valid, pickupAddress: 'D1', pickupArea: 'Ha Noi' })
    expect(result.errors).toEqual({})
    expect(result.payload.pickupAddress).toBe('D1, Ha Noi')
  })
  it.each([
    ['pickupLat', ''], ['pickupLat', 'NaN'], ['pickupLat', '91'], ['dropoffLng', '-181'],
    ['pickupAddress', 'abcd'], ['dropoffAddress', 'a'.repeat(256)], ['recipientName', 'a'],
    ['recipientPhone', '123'], ['packageWeightKg', '0'], ['packageWeightKg', 'Infinity'],
    ['notes', 'a'.repeat(501)], ['expectedDeliveryAt', '2000-01-01T00:00'], ['senderName', ''], ['senderPhone', '123'],
  ])('rejects invalid %s', (field, value) => {
    expect(validateShipmentDraft({ ...valid, [field]: value }).errors).toHaveProperty(field)
  })
  it('expires retries after 24 hours without replacing the key', () => {
    expect(canRetryIntent(0, 86_399_999)).toBe(true)
    expect(canRetryIntent(0, 86_400_000)).toBe(false)
  })
})
