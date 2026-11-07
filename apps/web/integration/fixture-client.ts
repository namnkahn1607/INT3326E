import { Worker } from 'node:worker_threads'
import { resolve } from 'node:path'

export const userId = (n: number) => 'usr_' + String(n).padStart(26, '0')
type Result = { rows: Record<string, unknown>[] }

export async function startServer() {
  // Nest/WASM runs in Node, independently of the DOM globals used by the UI tests.
  const worker = new Worker(resolve(process.cwd(), 'integration/server-worker.mjs'))
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  let nextId = 0
  let failStart: (error: Error) => void = () => {}
  const started = new Promise<string>((done, reject) => {
    failStart = reject
    worker.on('message', (message: { id?: number; base?: string; result?: unknown; error?: string }) => {
      if (message.base) { done(message.base); return }
      if (message.id === undefined) { reject(new Error(message.error)); return }
      const task = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) task?.reject(new Error(message.error))
      else task?.resolve(message.result)
    })
  })
  worker.on('error', error => {
    failStart(error)
    for (const task of pending.values()) task.reject(error)
    pending.clear()
  })
  worker.on('exit', code => {
    const error = new Error('Isolated API fixture exited: ' + code)
    failStart(error)
    for (const task of pending.values()) task.reject(error)
    pending.clear()
  })
  function call<T>(action: string, ...args: unknown[]): Promise<T> {
    return new Promise((done, reject) => {
      const id = ++nextId
      pending.set(id, { resolve: value => done(value as T), reject })
      worker.postMessage({ id, action, args })
    })
  }
  try {
    return {
      base: await started,
      query: (sql: string, params: unknown[] = []) => call<Result>('query', sql, params),
      reset: () => call('reset'),
      failNextAssignment: () => call('failNextAssignment'),
      close: async () => { try { await call('close') } finally { await worker.terminate() } },
    }
  } catch (error) { await worker.terminate(); throw error }
}
