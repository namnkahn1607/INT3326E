import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDriverLocation } from './useDriverLocation'

let node: HTMLDivElement, root: Root, result: ReturnType<typeof useDriverLocation>
let success: PositionCallback, failure: PositionErrorCallback | null | undefined
const current = vi.fn(), watch = vi.fn(), clear = vi.fn()
const position: GeolocationPosition = { timestamp: 0, coords: { latitude: 21, longitude: 105,
  accuracy: 1, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, toJSON: () => ({}) }
function Probe({ watching }: { watching: boolean }) {
  const location = useDriverLocation(watching)
  useEffect(() => { result = location }, [location])
  return null
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.resetAllMocks()
  const capture = (onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => { success = onSuccess; failure = onError; return 7 }
  current.mockImplementation(capture); watch.mockImplementation(capture)
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: current, watchPosition: watch, clearWatch: clear } })
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
const render = (watching = false) => act(async () => root.render(<Probe watching={watching} />))

describe('Geolocation lifecycle (mock browser location)', () => {
  it('retains both coordinate aliases and clears a previous error on successful recovery', async () => {
    await render(true)
    await act(async () => failure?.({ code: 2, message: 'Unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }))
    expect(result.error).toBe('Unavailable')
    await act(async () => success(position))
    expect(result.coords).toEqual({ lat: 21, lng: 105, latitude: 21, longitude: 105 })
    expect(result.error).toBeNull()
  })
  it('ignores a stale one-shot callback after switching to watch mode and cleans the watcher', async () => {
    await render(false)
    const previous = success
    await render(true)
    await act(async () => previous(position))
    const staleCoordinates = result.coords
    await act(async () => success(position))
    expect(staleCoordinates).toBeNull()
    expect(result.coords?.lat).toBe(21)
    await act(async () => root.render(null))
    expect(clear).toHaveBeenCalledWith(7)
  })
  it('reports unsupported browsers without requesting a location', async () => {
    vi.stubGlobal('navigator', {})
    await render()
    expect(result.error).toContain('không được hỗ trợ')
    expect(current).not.toHaveBeenCalled(); expect(watch).not.toHaveBeenCalled()
  })
})
