import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const origin = process.env.PARCELFLOW_REVIEW_ORIGIN ?? 'https://int3326e.web.app'
const debugOrigin = process.env.PARCELFLOW_REVIEW_CDP ?? 'http://127.0.0.1:9227'
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const timeout = AbortSignal.timeout(20000)
const index = readFileSync(new URL('../../apps/web/dist/index.html', import.meta.url))
const routes = ['/customer', '/admin', '/driver']

for (const route of [...routes, '/customer/create', '/admin/assignment', '/admin/accounts', '/admin/live-map']) {
  const response = await fetch(origin + route, { signal: timeout, headers: { 'Cache-Control': 'no-cache' } })
  assert.equal(response.status, 200, route)
  assert.ok(index.equals(Buffer.from(await response.arrayBuffer())), `${route}: index differs from local build`)
  console.log(`PASS HTTP/index ${route}`)
}
const asset = index.toString().match(/src="(\/assets\/[^\"]+\.js)"/)[1]
const response = await fetch(origin + asset, { signal: timeout })
assert.equal(response.status, 200)
const bundle = Buffer.from(await response.arrayBuffer())
assert.ok(bundle.equals(readFileSync(new URL('../../apps/web/dist' + asset, import.meta.url))))
console.log(`PASS bundle ${asset} SHA256=${createHash('sha256').update(bundle).digest('hex')}`)

const target = await (await fetch(`${debugOrigin}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})
let sequence = 0
const pending = new Map()
const errors = []
const gpsRequests = []
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const call = pending.get(message.id)
    if (call) {
      pending.delete(message.id)
      message.error ? call.reject(message.error) : call.resolve(message.result)
    }
  } else if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.text)
  } else if (message.method === 'Network.requestWillBeSent' && /\/v1\/locations(?:\?|$)/.test(message.params.request.url)) {
    gpsRequests.push(message.params.request.url)
  }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const waitFor = async (expression) => {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate(expression)) return
    await pause(300)
  }
  throw new Error(`Timed out: ${expression}`)
}
const ready = (route) => {
  const selector = route === '/driver' ? '#gps-emitter-title' : route.startsWith('/admin') ? '.admin-layout h1' : '.customer-layout h1'
  return `location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(selector)})`
}

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const originalSet = window.setInterval.bind(window);
    const originalClear = window.clearInterval.bind(window);
    window.__gpsIntervals = new Set();
    window.__geoCalls = 0;
    window.setInterval = (fn, ms, ...args) => {
      const id = originalSet(fn, ms, ...args);
      if (ms === 8000) window.__gpsIntervals.add(id);
      return id;
    };
    window.clearInterval = id => { window.__gpsIntervals.delete(id); return originalClear(id); };
    for (const key of ['getCurrentPosition', 'watchPosition']) {
      const original = navigator.geolocation[key].bind(navigator.geolocation);
      navigator.geolocation[key] = (...args) => { window.__geoCalls++; return original(...args); };
    }
  })()` })
  await send('Page.bringToFront')
  for (const route of routes) {
    await send('Page.navigate', { url: origin + route })
    await waitFor(ready(route))
    await send('Page.reload', { ignoreCache: true })
    await waitFor(ready(route))
    for (const width of [1280, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false })
      await pause(250)
      const layout = await evaluate(`({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('main h1, main h2')?.textContent, minFont: getComputedStyle(document.querySelector('main')).fontSize })`)
      assert.ok(layout.scrollWidth <= width + 1, `${route}: horizontal overflow ${JSON.stringify(layout)}`)
      assert.ok(layout.title)
      console.log(`PASS direct/refresh/layout ${route} ${width}px ${JSON.stringify(layout)}`)
    }
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    assert.ok(await evaluate(`['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)`), `${route}: keyboard focus`)
    console.log(`PASS keyboard focus ${route}`)
  }

  await send('Page.navigate', { url: origin + '/driver' })
  await waitFor(ready('/driver'))
  await send('Page.bringToFront')
  await send('Emulation.setFocusEmulationEnabled', { enabled: true })
  const snapshot = () => evaluate(`(() => {
    const buttons = [...document.querySelectorAll('button')];
    const payload = document.querySelector('pre code');
    return {
      startDisabled: buttons[0].disabled, stopDisabled: buttons[1].disabled,
      timers: window.__gpsIntervals.size, geoCalls: window.__geoCalls,
      payload: payload ? JSON.parse(payload.textContent) : null,
      count: Number(document.querySelector('[role="status"]').textContent.match(/(\\d+)\\s*$/)[1])
    };
  })()`)
  let state = await snapshot()
  assert.equal(state.count, 0)
  assert.equal(state.payload, null)
  assert.equal(state.timers, 0)
  assert.equal(state.startDisabled, false)
  assert.equal(state.stopDisabled, true)
  await evaluate(`document.querySelectorAll('button')[0].focus()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  await pause(200)
  assert.equal((await snapshot()).timers, 1)
  await evaluate(`document.querySelectorAll('button')[0].click()`)
  assert.equal((await snapshot()).timers, 1)
  console.log('PASS initial state, keyboard Start, one timer/no duplicate')
  await waitFor(`!!document.querySelector('pre code')`)
  state = await snapshot()
  assert.equal(state.count, 1)
  assert.equal(state.payload.driverId, 'demo-driver-1')
  assert.equal(state.payload.lat, 21.0285)
  assert.equal(state.payload.lng, 105.8542)
  assert.ok(Number.isFinite(Date.parse(state.payload.clientTimestamp)))
  const firstTime = state.payload.clientTimestamp
  await waitFor(`Number(document.querySelector('[role="status"]').textContent.match(/(\\d+)\\s*$/)[1]) >= 2`)
  state = await snapshot()
  assert.equal(state.count, 2)
  assert.notEqual(state.payload.clientTimestamp, firstTime)
  console.log('PASS two consecutive sample payloads with new timestamps')
  await evaluate(`document.querySelectorAll('button')[1].click()`)
  await pause(200)
  const stopped = await snapshot()
  assert.equal(stopped.timers, 0)
  assert.equal(stopped.startDisabled, false)
  assert.equal(stopped.stopDisabled, true)
  await pause(8500)
  assert.deepEqual(await snapshot(), stopped)
  console.log('PASS Stop preserves payload/count after another interval')
  await evaluate(`document.querySelectorAll('button')[0].click()`)
  await waitFor(`Number(document.querySelector('[role="status"]').textContent.match(/(\\d+)\\s*$/)[1]) >= 3`)
  assert.equal((await snapshot()).timers, 1)
  await evaluate(`history.pushState({}, '', '/customer'); window.dispatchEvent(new PopStateEvent('popstate'))`)
  await waitFor(ready('/customer'))
  assert.equal(await evaluate('window.__gpsIntervals.size'), 0)
  await pause(8500)
  assert.equal(await evaluate('window.__gpsIntervals.size'), 0)
  assert.equal(await evaluate('window.__geoCalls'), 0)
  await evaluate(`history.pushState({}, '', '/driver'); window.dispatchEvent(new PopStateEvent('popstate'))`)
  await waitFor(ready('/driver'))
  assert.equal((await snapshot()).count, 0)
  assert.equal((await snapshot()).timers, 0)
  assert.deepEqual(gpsRequests, [])
  assert.deepEqual(errors, [])
  console.log('PASS restart, SPA unmount cleanup, fresh remount; no geolocation/GPS requests/JS exceptions')
} finally {
  await send('Page.close').catch(() => {})
  ws.close()
}
