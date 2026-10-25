import { act, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OsmBaseLayer } from './OsmBaseLayer'

const mocks = vi.hoisted(() => ({ redraw: vi.fn(), props: {} as {
  url?: string; attribution?: string; keepBuffer?: number; updateWhenIdle?: boolean
  eventHandlers?: Record<string, () => void>
} }))
vi.mock('react-leaflet', async () => {
  const { useImperativeHandle } = await import('react')
  return { TileLayer: ({ ref, ...props }: typeof mocks.props & { ref: Ref<unknown> }) => {
    mocks.props = props
    useImperativeHandle(ref, () => ({ redraw: mocks.redraw }))
    return <span data-testid="raster-tiles" />
  } }
})
let node: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubEnv('VITE_CARTO_API_KEY', '')
  vi.useFakeTimers(); mocks.redraw.mockReset()
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const mount = () => act(async () => root.render(<OsmBaseLayer />))
const emit = (name: string) => act(async () => mocks.props.eventHandlers?.[name]?.())

describe('Lightweight OSM basemap (mock tiles)', () => {
  it('uses the configured CARTO raster layer without a WebGL SDK', async () => {
    vi.stubEnv('VITE_CARTO_API_KEY', 'tile-test-key')
    await mount()
    expect(mocks.props.url).toBe('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=tile-test-key')
    expect(mocks.props.attribution).toContain('CARTO')
    expect(mocks.props.attribution).toContain('OpenStreetMap')
    expect(node.querySelector('[data-map-provider=CARTO]')).not.toBeNull()
  })
  it('uses raster tiles without keys and retains attribution with a small tile buffer', async () => {
    await mount()
    expect(mocks.props.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(mocks.props.attribution).toContain('OpenStreetMap')
    expect(mocks.props.keepBuffer).toBe(1)
    expect(mocks.props.updateWhenIdle).toBe(true)
    await emit('loading'); await emit('load')
    expect(node.querySelector('[role=status]')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not hide tile errors when a partially failed batch finishes', async () => {
    await mount(); await emit('loading'); await emit('tileerror'); await emit('load')
    expect(node.textContent).toContain('Chưa tải được đầy đủ bản đồ.')
  })
  it('retries only tiles without replacing the map or selected points', async () => {
    await mount(); await emit('tileerror')
    const tiles = node.querySelector('[data-testid=raster-tiles]')
    await act(async () => node.querySelector<HTMLButtonElement>('button')!.click())
    expect(mocks.redraw).toHaveBeenCalledTimes(1)
    expect(node.querySelector('[data-testid=raster-tiles]')).toBe(tiles)
    await emit('load')
    expect(node.querySelector('[role=status]')).toBeNull()
  })
  it('shows slow loading inside the map and recovers when tiles finish', async () => {
    await mount(); await emit('loading')
    await act(async () => vi.advanceTimersByTime(12_000))
    expect(node.textContent).toContain('Bản đồ tải chậm.')
    await emit('load')
    expect(node.querySelector('[role=status]')).toBeNull()
  })
  it('keeps retry interaction from selecting a new shipping point', async () => {
    await mount(); await emit('tileerror')
    const selected = vi.fn(); node.addEventListener('mousedown', selected)
    expect((node.querySelector('[role=status]') as HTMLElement & { _leaflet_disable_click?: boolean })._leaflet_disable_click).toBe(true)
    await act(async () => node.querySelector<HTMLButtonElement>('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(selected).not.toHaveBeenCalled()
  })
  it('cleans its loading timeout on unmount', async () => {
    await mount(); await emit('loading')
    await act(async () => root.render(null))
    expect(vi.getTimerCount()).toBe(0)
  })
})
