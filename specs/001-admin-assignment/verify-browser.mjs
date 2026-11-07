import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { shipmentFixture } from '../../apps/web/src/features/customer/shipment-fixture.ts'

// All auth/API responses below exist only in this CDP test tab, never in the app.
const origin = process.env.ADMIN_REVIEW_ORIGIN ?? 'http://127.0.0.1:5174'
const debug = process.env.ADMIN_REVIEW_CDP ?? 'http://127.0.0.1:9232'
for (const url of [origin, debug]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Local review only')
const target = await (await fetch(debug + '/json/new?about:blank', { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
let seq = 0
const pending = new Map()
const exceptions = []
const posts = []
const requests = []
let mode = 'success', role = 'ADMIN'
let shipment = { ...shipmentFixture }
const driver = { id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', name: 'Tài xế An', activeShipmentCount: 3,
  currentLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null }
const other = { ...driver, id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAY', name: 'Tài xế Bình' }
const page = data => ({ data, pagination: { limit: 20, hasMore: false, nextCursor: null } })
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
})
const fulfill = (requestId, body, status = 200, type = 'application/json') => send('Fetch.fulfillRequest', {
  requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: type },
    { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: '*' },
    { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }],
  body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64'),
})
async function intercept({ requestId, request }) {
  const url = new URL(request.url)
  if (url.pathname.endsWith('/features/auth/AuthContext.tsx')) return fulfill(requestId, `
    import React from '/node_modules/.vite/deps/react.js';
    import { AuthContext } from '/src/features/auth/context.ts';
    export function AuthProvider({children}) { return React.createElement(AuthContext.Provider, {value:{
      user:{id:'browser-test-user',email:'browser@example.invalid',displayName:'Admin test',role:${JSON.stringify(role)}},
      token:null,loading:false,error:null,login:async()=>{throw new Error('Not used in browser review')},logout:async()=>{},refresh:async()=>{}
    }}, children); }
  `, 200, 'text/javascript')
  if (url.pathname.startsWith('/v1/')) {
    requests.push({ path: url.pathname, method: request.method })
    if (request.method === 'OPTIONS') return fulfill(requestId, '')
    if (request.method === 'POST' && url.pathname.endsWith('/assign')) {
      posts.push({ body: JSON.parse(request.postData), headers: request.headers })
      if (mode === 'conflict' || mode === 'unknown') {
        shipment = { ...shipment, status: 'ASSIGNED', driverId: other.id }
        return fulfill(requestId, { code: mode === 'conflict' ? 'CONFLICT' : 'SERVICE_UNAVAILABLE' }, mode === 'conflict' ? 409 : 503)
      }
      shipment = { ...shipment, status: 'ASSIGNED', driverId: driver.id }
      return fulfill(requestId, shipment)
    }
    if (mode === 'list-error' && url.pathname === '/v1/shipments') return fulfill(requestId, { code: 'SERVICE_UNAVAILABLE' }, 503)
    if (url.pathname === '/v1/drivers') return fulfill(requestId, page([driver, other]))
    if (url.pathname === '/v1/shipments') {
      const status = url.searchParams.get('status')
      return fulfill(requestId, page(!status || shipment.status === status ? [shipment] : []))
    }
    if (url.pathname === '/v1/shipments/' + shipment.id) return fulfill(requestId, { ...shipment, statusHistory: [] })
    return fulfill(requestId, { code: 'RESOURCE_NOT_FOUND' }, 404)
  }
  return send('Fetch.continueRequest', { requestId })
}
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const call = pending.get(message.id)
    if (call) { pending.delete(message.id); message.error ? call.reject(message.error) : call.resolve(message.result) }
  } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
  else if (message.method === 'Fetch.requestPaused') void intercept(message.params).catch(error => {
    if (!String(error.message ?? '').includes('Invalid InterceptionId')) exceptions.push(error)
  })
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function wait(expression) {
  for (let i = 0; i < 70; i++) { if (await evaluate(expression)) return; await delay(100) }
  throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText') + '\n' + JSON.stringify(exceptions))
}
async function visit(path) { await send('Page.navigate', { url: origin + path }); await wait('document.readyState === "complete" && !!document.querySelector(".admin-page")') }
async function click(text) {
  await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)})); if(!button||button.disabled) throw new Error('Unavailable button'); button.click(); })()`)
}
async function choose() {
  await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(shipmentFixture.trackingNumber)}))`)
  await click(shipmentFixture.trackingNumber)
  await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Tài xế An'))`)
  await click('Tài xế An'); await click('Xem lại phân công')
  await wait('!!document.querySelector(".admin-assignment-review")')
  assert.equal(await evaluate('document.activeElement === document.querySelector(".admin-assignment-review")'), true)
}
function reset(next = 'success') { mode = next; shipment = { ...shipmentFixture } }
const summary = []
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  for (const [width, height] of [[375, 812], [1440, 900], [812, 375]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    for (const path of ['/admin/shipments', '/admin/drivers', '/admin/assignment']) {
      reset(); await visit(path)
      await wait('!document.querySelector(".customer-skeleton") && document.body.innerText.includes("trang đang hiển thị")')
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page overflow: ' + path + width)
      assert.equal(await evaluate('!!document.querySelector(".ui-demo-notice")'), false)
    }
    await choose()
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    writeFileSync(join(tmpdir(), 'parcelflow-admin-review-' + width + '.png'), Buffer.from(shot.data, 'base64'))
    const before = posts.length
    await click('Xác nhận phân công')
    await wait('document.body.innerText.includes("Máy chủ đã xác nhận")')
    assert.equal(posts.length, before + 1)
    assert.deepEqual(posts.at(-1).body, { driverId: driver.id })
    assert.ok(!Object.keys(posts.at(-1).headers).some(key => key.toLowerCase() === 'idempotency-key'))
    summary.push({ width, height, pages: 3, confirmation: 'pass' })
  }
  for (const next of ['conflict', 'unknown']) {
    reset(next); await visit('/admin/assignment'); await choose()
    const before = posts.length
    await click('Xác nhận phân công')
    await wait('document.body.innerText.includes("Đã đọc lại trạng thái hiện tại")')
    assert.equal(posts.length, before + 1)
    assert.equal(await evaluate('document.body.innerText.includes("Máy chủ đã xác nhận")'), false)
    assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Xem lại phân công")).disabled'), true)
  }
  reset('list-error'); await visit('/admin/shipments')
  await wait('!!document.querySelector(".admin-api-error")')
  assert.equal(await evaluate('!!document.querySelector("tbody")'), false)
  reset(); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await visit('/admin/assignment'); await choose(); await click('Hủy xác nhận')
  await wait('document.activeElement?.textContent.includes("Xem lại phân công")')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await wait('!!document.querySelector(".admin-assignment-review")')
  await evaluate('document.documentElement.style.fontSize="200%"')
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Text scaling overflow')
  role = 'CUSTOMER'; await send('Page.navigate', { url: origin + '/admin/assignment' })
  await wait('document.body.innerText.includes("Không có quyền truy cập")')
  assert.equal(await evaluate('!!document.querySelector(".admin-page")'), false)
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions))
  console.log(JSON.stringify({ level: 'Local browser with mocked auth and API only', summary, recovery: '409/503 GET-only pass', keyboard: 'review focus/cancel/Enter pass', reducedMotion: 'pass', textScale: '200% pass', wrongRole: 'access denied pass', exceptions: exceptions.length, posts: posts.length }))
} finally {
  ws.close()
  await fetch(debug + '/json/close/' + target.id)
}
