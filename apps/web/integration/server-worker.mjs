import { parentPort } from 'node:worker_threads'
import { startServer } from './server.mjs'

try {
  const server = await startServer()
  parentPort.postMessage({ base: server.base })
  parentPort.on('message', async ({ id, action, args }) => {
    try {
      if (!['query', 'reset', 'failNextAssignment', 'close'].includes(action)) throw new Error('Unknown fixture action')
      const result = await server[action](...args)
      parentPort.postMessage({ id, result })
      if (action === 'close') parentPort.close()
    } catch (error) { parentPort.postMessage({ id, error: error.message }) }
  })
} catch (error) { parentPort.postMessage({ error: error.message }); parentPort.close() }
