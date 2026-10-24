import { describe, expect, it } from 'vitest'
import { emptyShipmentDraft, validateShipmentDraft, canRetryIntent } from './shipment-form'

const valid = { ...emptyShipmentDraft, pickupAddress: ' 144 Xuan Thuy ', pickupLat: '0', pickupLng: '0',
  dropoffAddress: '1 Dai Co Viet', dropoffLat: '21', dropoffLng: '105',
  recipientName: 'Nguoi nhan', recipientPhone: '+84901234567' }

describe('Create form normalization', () => {
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
  it.each([
    ['pickupLat', ''], ['pickupLat', 'NaN'], ['pickupLat', '91'], ['dropoffLng', '-181'],
    ['pickupAddress', 'abcd'], ['dropoffAddress', 'a'.repeat(256)], ['recipientName', 'a'],
    ['recipientPhone', '123'], ['packageWeightKg', '0'], ['packageWeightKg', 'Infinity'],
    ['notes', 'a'.repeat(501)], ['expectedDeliveryAt', '2000-01-01T00:00'],
  ])('rejects invalid %s', (field, value) => {
    expect(validateShipmentDraft({ ...valid, [field]: value }).errors).toHaveProperty(field)
  })
  it('expires retries after 24 hours without replacing the key', () => {
    expect(canRetryIntent(0, 86_399_999)).toBe(true)
    expect(canRetryIntent(0, 86_400_000)).toBe(false)
  })
})
