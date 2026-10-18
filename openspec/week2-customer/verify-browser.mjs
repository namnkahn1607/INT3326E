import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { shipmentFixture } from '../../apps/web/src/features/customer/shipment-fixture.ts'

const origin = process.env.PARCELFLOW_REVIEW_ORIGIN ?? 'http://127.0.0.1:5174'
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin), 'Local mock review only')
const cdp = process.env.PARCELFLOW_REVIEW_CDP ?? 'http://127.0.0.1:9232'
const target = await (await fetch(cdp + '/json/new?about:blank', { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const exceptions = []
const posts = []
const runtimeErrors = []
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const current = ++id
    const timer = setTimeout(() => { pending.delete(current); reject(new Error(method + ' timeout')) }, 15_000)
    pending.set(current, { resolve, reject, timer }); socket.send(JSON.stringify({ id: current, method, params }))
  })
}
const actualAuth = await (await fetch(origin + '/src/features/auth/AuthContext.tsx')).text()
const reactPath = actualAuth.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1]
assert.ok(reactPath, 'Vite React dependency path')
const mockAuth = `import React from ${JSON.stringify(reactPath)};
import { AuthContext } from '/src/features/auth/context.ts';
export function AuthProvider({children}) { return React.createElement(AuthContext.Provider, {value: {
  user: location.pathname === '/login' ? null : {id:'test-customer',email:'test@example.invalid',role:'CUSTOMER',displayName:'Tega'},
  token:null,loading:false,error:null,login:async()=>{},logout:async()=>{},refresh:async()=>{}
}}, children) }`
async function intercept(params) {
  const { requestId, request } = params
  const url = new URL(request.url)
  let body, responseCode = 200, contentType = 'application/json'
  if (url.pathname.endsWith('/AuthContext.tsx')) { body = mockAuth; contentType = 'text/javascript' }
  else if (url.pathname.startsWith('/v1/')) {
    if (request.method === 'OPTIONS') body = ''
    else if (request.method === 'POST') {
      posts.push({ body: request.postData, key: Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'idempotency-key')?.[1] })
      responseCode = posts.length === 1 ? 503 : 201
      body = JSON.stringify(posts.length === 1 ? { code: 'SERVICE_UNAVAILABLE' } : shipmentFixture)
    } else if (url.pathname === '/v1/shipments') {
      body = JSON.stringify({ data: [{ ...shipmentFixture, status: 'PICKED_UP', driverId: shipmentFixture.customerId, packageDescription: 'Electronics' }], pagination: { limit: 20, hasMore: false, nextCursor: null } })
    } else body = JSON.stringify({ ...shipmentFixture, status: 'ASSIGNED', driverId: shipmentFixture.customerId, statusHistory: [] })
  } else return send('Fetch.continueRequest', { requestId })
  await send('Fetch.fulfillRequest', { requestId, responseCode,
    responseHeaders: [{ name: 'Content-Type', value: contentType }, { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
      { name: 'Access-Control-Allow-Headers', value: 'content-type,authorization,idempotency-key' }],
    body: Buffer.from(body).toString('base64') })
}
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const call = pending.get(message.id)
    if (call) { clearTimeout(call.timer); pending.delete(message.id); message.error ? call.reject(message.error) : call.resolve(message.result) }
  } else if (message.method === 'Fetch.requestPaused') intercept(message.params).catch(error => runtimeErrors.push(String(error)))
  else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
})
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function wait(expression) {
  for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await pause(150) }
  throw new Error('UI timeout: ' + expression + ' ' + JSON.stringify({ exceptions, runtimeErrors,
    page: await evaluate('({url:location.href,text:document.body?.innerText.slice(0,1800),overlay:document.querySelector("vite-error-overlay")?.shadowRoot?.textContent?.slice(0,1500)})') }))
}
async function visit(path) {
  await send('Page.navigate', { url: origin + path })
  await wait(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && !!document.querySelector('h1')`)
}
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [
    { urlPattern: '*AuthContext.tsx*' }, { urlPattern: '*/v1/*' },
  ] })
  await send('Emulation.setFocusEmulationEnabled', { enabled: true })
  for (const path of ['/login', '/customer', '/customer/create', '/customer/shipments', '/customer/shipments/' + shipmentFixture.id]) {
    await visit(path)
    const contentReady = path === '/login' ? "!!document.querySelector('.auth-page input')" : path.endsWith('/create') ? "!!document.querySelector('input[name=pickupAddress]')" : `document.body.textContent.includes('${shipmentFixture.trackingNumber}')`
    await wait(contentReady)
    await send('Page.reload', { ignoreCache: true })
    await pause(200)
    await wait(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && (${contentReady})`)
    for (const width of [390, 768, 1280, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
      await pause(100)
      const layout = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,
        inputFont:document.querySelector('input') ? getComputedStyle(document.querySelector('input')).fontSize : null,
        title:document.querySelector('h1')?.textContent,url:location.pathname})`)
      assert.ok(layout.scroll <= width + 1, path + ' overflow ' + JSON.stringify(layout))
      if (layout.inputFont) assert.ok(parseFloat(layout.inputFont) >= 16)
      console.log('PASS mock direct/refresh/layout', path, width, JSON.stringify(layout))
      if ((path === '/customer/create' && width === 390) || (path === '/login' && width === 1280) || (path === '/customer' && [390, 1440].includes(width))) {
        if (path === '/customer') {
          await wait("document.querySelector('.pf-promo-art')?.complete && document.querySelector('.pf-promo-art')?.naturalWidth > 0")
          await evaluate('document.fonts.ready.then(() => true)')
        }
        const screenshot = await send('Page.captureScreenshot', { format: 'png' })
        const file = join(tmpdir(), path === '/customer' ? 'parcelflow-premium-home-' + width + '.png' : path === '/login' ? 'parcelflow-week2-login.png' : 'parcelflow-week2-create.png')
        writeFileSync(file, Buffer.from(screenshot.data, 'base64'))
        console.log('Screenshot', file)
        if (path === '/customer' && width === 1440 && process.env.PARCELFLOW_EXPORT_WEBP === '1') {
          const data = await evaluate(`(() => { const img=document.querySelector('.pf-promo-art');const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL('image/webp',.86).split(',')[1] })()`)
          const asset = join(tmpdir(), 'parcelflow-premium-parcels.webp')
          writeFileSync(asset, Buffer.from(data, 'base64')); console.log('Exported WebP', asset)
        }
      }
    }
  }
  await visit('/customer'); await wait("!!document.querySelector('.pf-home')")
  await evaluate(`(() => {const input=document.querySelector('#pf-tracking-number');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'${shipmentFixture.trackingNumber}');input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await evaluate("document.querySelector('.pf-track-form').requestSubmit()")
  await wait(`location.search.includes('${shipmentFixture.trackingNumber}') && !!document.querySelector('.customer-api-page')`)
  console.log('PASS premium home exact tracking search, existing Orders navigation')
  await visit('/customer/create'); await wait("!!document.querySelector('form')")
  await evaluate("document.querySelector('input[name=pickupAddress]').focus()")
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  assert.equal(await evaluate('document.activeElement.name'), 'pickupLat')
  await evaluate("document.querySelector('button[type=submit]').focus()")
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: type === 'keyDown' ? '\r' : undefined })
  await wait("document.activeElement?.getAttribute('role') === 'alert'")
  assert.equal(posts.length, 0)
  console.log('PASS keyboard Tab/Enter validation/error-summary focus, no invalid POST')
  const values = { pickupAddress: '144 Xuan Thuy', pickupLat: '0', pickupLng: '0', dropoffAddress: '1 Dai Co Viet',
    dropoffLat: '21', dropoffLng: '105', recipientName: 'Test recipient', recipientPhone: '0901234567' }
  await evaluate(`(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    for(const [name,value] of Object.entries(${JSON.stringify(values)})) { const input=document.querySelector('[name="'+name+'"]');
      setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true})); } })()`)
  await evaluate("document.querySelector('form').requestSubmit()")
  await wait("!!document.querySelector('input:disabled') && !!document.querySelector('[role=alert]')")
  await evaluate("document.querySelector('form').requestSubmit()")
  await wait(`document.body.textContent.includes('${shipmentFixture.trackingNumber}')`)
  assert.equal(posts.length, 2); assert.deepEqual(posts[0], posts[1])
  assert.ok(posts[0].key)
  console.log('PASS mock Create 503/retry same key+body, zero coordinates, confirmed tracking number')
  await evaluate(`document.querySelector('a[href="/customer/shipments/${shipmentFixture.id}"]').click()`)
  await wait("!!document.querySelector('dl')")
  assert.equal(await evaluate('document.querySelector("dl").textContent.includes("144 Xuan Thuy")'), true)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.customer-api-page button')).transitionDuration"), '0s')
  await visit('/admin')
  await wait("!!document.querySelector('.auth-card h1')")
  assert.equal(await evaluate("!!document.querySelector('.admin-layout')"), false)
  console.log('PASS detail navigation, reduced-motion, Customer denied Admin (mock identity)')
  assert.deepEqual(exceptions, []); assert.deepEqual(runtimeErrors, [])
  console.log('PASS no browser JS exceptions; MOCK ONLY, not Firebase/DB/cloud acceptance')
} finally {
  await send('Page.close').catch(() => {}); socket.close()
}
