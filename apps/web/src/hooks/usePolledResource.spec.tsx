import { act, useCallback, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePolledResource } from './usePolledResource'

const read = vi.fn()
let root: Root, node: HTMLDivElement, current: ReturnType<typeof usePolledResource<string>>
function Probe({ cursor }: { cursor: string }) {
  const load = useCallback((signal: AbortSignal) => read(cursor, signal), [cursor])
  const result = usePolledResource<string>(load, cursor)
  useEffect(() => { current = result }, [result])
  return <p>{result.data}</p>
}
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); read.mockReset(); node = document.createElement('div'); document.body.append(node); root = createRoot(node) })
afterEach(async () => { await act(async () => root.unmount()); expect(vi.getTimerCount()).toBe(0); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
const render = (cursor: string) => act(async () => root.render(<Probe cursor={cursor} />))
describe('Paged polling isolation', () => {
  it('aborts old cursor reads and polls only the selected page', async () => {
    let finish!: (value: string) => void
    read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue('page-b')
    await render('a'); const signal = read.mock.calls[0][1] as AbortSignal
    await render('b'); await act(async () => finish('page-a'))
    expect(signal.aborted).toBe(true); expect(current.data).toBe('page-b')
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(read.mock.calls.slice(1).every(call => call[0] === 'b')).toBe(true)
  })
  it('manual retry cancels a pending read and ignores its late error', async () => {
    let fail!: (value: unknown) => void
    read.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject })).mockResolvedValue('new')
    await render('a'); const signal = read.mock.calls[0][1] as AbortSignal
    await act(async () => current.refresh()); await act(async () => fail(new Error('late')))
    expect(signal.aborted).toBe(true); expect(current.data).toBe('new'); expect(current.error).toBeNull()
  })
})
