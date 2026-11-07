import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const origin = process.env.PARCELFLOW_REVIEW_ORIGIN ?? 'http://127.0.0.1:5174'
const cdp = process.env.PARCELFLOW_REVIEW_CDP ?? 'http://127.0.0.1:9232'
for (const url of [origin, cdp]) assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/)
const authSource = await (await fetch(origin + '/src/features/auth/AuthContext.tsx')).text()
const reactPath = authSource.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1]
assert.ok(reactPath, 'Vite React module path')
const auth = `import React from ${JSON.stringify(reactPath)};
import { AuthContext } from '/src/features/auth/context.ts';
export function AuthProvider({children}) { return React.createElement(AuthContext.Provider, {value:{
user:{id:'browser-customer',email:'browser@example.invalid',role:'CUSTOMER',displayName:'Customer'},
token:null,loading:false,error:null,login:async()=>{},logout:async()=>{},refresh:async()=>{}
}},children) }`
let reviewRole = 'CUSTOMER'
let mockGeocoding = false
const target = await (await fetch(cdp + '/json/new?about:blank', { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const errors = []
const geocoding = []
const districtLookups = []
const tileRequests = []
const tileIds = new Set()
const tileFailures = []
const posts = []
let releaseReverseLookup
let heldReverseLookup = null
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const current = ++id
    const timer = setTimeout(() => { pending.delete(current); reject(new Error(method + ' timeout')) }, 15_000)
    pending.set(current, { resolve, reject, timer })
    socket.send(JSON.stringify({ id: current, method, params }))
  })
}
async function intercept({ requestId, request }) {
  const url = new URL(request.url)
  let body, responseCode = 200, type = 'application/json'
  if (url.pathname.endsWith('/AuthContext.tsx')) { body = auth.replace("role:'CUSTOMER'", "role:'" + reviewRole + "'"); type = 'text/javascript' }
  else if (url.hostname === 'maps.vietmap.vn' && url.pathname.startsWith('/api/')) {
    if (!mockGeocoding) return send('Fetch.continueRequest', { requestId })
    assert.equal(request.method, 'GET')
    assert.ok(!Object.keys(request.headers).some(name => /^(authorization|cookie)$/i.test(name)))
    const boundaries = [{ type: 2, full_name: 'Phường Quan Hoa' }, { type: 1, full_name: 'Quận Cầu Giấy' }, { type: 0, full_name: 'Thành phố Hà Nội' }]
    if (url.pathname === '/api/autocomplete/v4') {
      assert.equal(url.searchParams.get('text'), 'Quận Cầu Giấy, Thành phố Hà Nội')
      districtLookups.push(url.pathname)
      body = JSON.stringify([{ ref_id: 'auto:district', name: 'Quận Cầu Giấy', display: 'Quận Cầu Giấy, Thành phố Hà Nội', boundaries }])
    } else if (url.pathname === '/api/place/v4') {
      assert.equal(url.searchParams.get('refid'), 'auto:district')
      body = JSON.stringify({ lat: 21.03, lng: 105.79, display: 'Quận Cầu Giấy, Thành phố Hà Nội',
        street: 'Duong Xuan Thuy', ward: 'Phường Quan Hoa', district: 'Quận Cầu Giấy', city: 'Thành phố Hà Nội' })
    } else {
    assert.equal(url.pathname, '/api/reverse/v4')
    assert.deepEqual([...url.searchParams.keys()].sort(), ['apikey', 'display_type', 'lat', 'lng'])
    geocoding.push(url.pathname)
    if (heldReverseLookup) await heldReverseLookup
    body = JSON.stringify([{ ref_id: 'reverse:test', name: 'Duong Xuan Thuy', display: 'Duong Xuan Thuy, Hà Nội',
      lat: Number(url.searchParams.get('lat')) + .0002, lng: Number(url.searchParams.get('lng')) + .0002, boundaries }])
    }
  } else if (url.hostname === 'provinces.open-api.vn') {
    assert.equal(request.method, 'GET')
    assert.ok(!Object.keys(request.headers).some(key => /^(authorization|cookie)$/i.test(key)))
    const province = { code: 1, name: 'Thành phố Hà Nội' }, district = { code: 5, name: 'Quận Cầu Giấy' }, ward = { code: 160, name: 'Phường Quan Hoa' }
    if (url.pathname === '/api/v1/p/') body = JSON.stringify([province])
    else if (url.pathname === '/api/v1/p/1' && url.search === '?depth=2') body = JSON.stringify({ ...province, districts: [district] })
    else if (url.pathname === '/api/v1/d/5' && url.search === '?depth=2') body = JSON.stringify({ ...district, wards: [ward] })
    else throw new Error('Unexpected directory endpoint')
  } else if (url.pathname.startsWith('/v1/')) {
    if (request.method === 'OPTIONS') { responseCode = 204; body = '' }
    else {
      if (request.method === 'POST') posts.push(JSON.parse(request.postData))
      responseCode = 404; body = JSON.stringify({ code: 'RESOURCE_NOT_FOUND' })
    }
  }
  else return send('Fetch.continueRequest', { requestId })
  await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [
    { name: 'Content-Type', value: type }, { name: 'Access-Control-Allow-Origin', value: origin },
    { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
    { name: 'Access-Control-Allow-Headers', value: 'content-type,authorization,idempotency-key' },
  ], body: Buffer.from(body).toString('base64') })
}
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const call = pending.get(message.id)
    if (call) {
      clearTimeout(call.timer); pending.delete(message.id)
      if (message.error) call.reject(message.error); else call.resolve(message.result)
    }
  } else if (message.method === 'Fetch.requestPaused') intercept(message.params).catch(error => {
    // Chrome discards interception IDs when an AbortController cancels the underlying request.
    if (error.code !== -32602 || !/Invalid InterceptionId/.test(error.message)) errors.push(error instanceof Error ? error.stack : JSON.stringify(error))
  })
  else if (message.method === 'Page.javascriptDialogOpening' && message.params.type === 'beforeunload') {
    send('Page.handleJavaScriptDialog', { accept: true }).catch(error => errors.push(String(error)))
  }
  else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  else if (message.method === 'Network.requestWillBeSent' && ['tile.openstreetmap.org', 'basemaps.cartocdn.com'].includes(new URL(message.params.request.url).hostname)) {
    const safeUrl = new URL(message.params.request.url)
    safeUrl.searchParams.delete('key')
    tileRequests.push(safeUrl.href); tileIds.add(message.params.requestId)
  } else if (message.method === 'Network.requestWillBeSent' && new URL(message.params.request.url).hostname === 'maps.vietmap.vn' && !/^\/api\/(autocomplete|reverse|place)\/v4$/.test(new URL(message.params.request.url).pathname)) {
    errors.push('Unexpected request to removed VIETMAP basemap')
  } else if (message.method === 'Network.loadingFailed' && tileIds.has(message.params.requestId)) tileFailures.push(message.params.errorText)
  else if (message.method === 'Network.responseReceived' && tileIds.has(message.params.requestId) && message.params.response.status >= 400) tileFailures.push('HTTP ' + message.params.response.status)
})
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function wait(expression) {
  for (let attempt = 0; attempt < 80; attempt++) { if (await evaluate(expression)) return; await pause(150) }
  throw new Error('UI timeout: ' + expression + JSON.stringify({ errors, text: await evaluate('document.body.innerText.slice(0,2000)') }))
}
async function input(name, value) {
  await evaluate(`(() => {const element=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}))})()`)
}
async function choose(id, value) {
  await wait(`!document.querySelector('#${id}').disabled`)
  await evaluate(`(() => {const select=document.querySelector('#${id}');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
}
async function screenshot(label, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await pause(250)
  const layout = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,dialog:(document.querySelector(".shipment-map-dialog[open]") ?? document.querySelector("dialog[open]"))?.getBoundingClientRect().width})')
  assert.ok(layout.scroll <= width + 1, JSON.stringify(layout))
  const alignment = await evaluate("(() => {const header=document.querySelector('.pf-home-header-inner').getBoundingClientRect();const page=document.querySelector('.shipment-create-page').getBoundingClientRect();return {headerLeft:header.left,pageLeft:page.left,headerRight:header.right,pageRight:page.right}})()")
  assert.ok(Math.abs(alignment.headerLeft - alignment.pageLeft) <= 1 && Math.abs(alignment.headerRight - alignment.pageRight) <= 1, JSON.stringify(alignment))
  if (layout.dialog) {
    assert.ok(layout.dialog < width)
    assert.equal(await evaluate('(() => {const d=document.querySelector(".shipment-map-dialog[open]") ?? document.querySelector("dialog[open]");return d.scrollWidth <= d.clientWidth})()'), true)
  }
  const result = await send('Page.captureScreenshot', { format: 'png' })
  const path = join(tmpdir(), 'parcelflow-' + label + '-' + width + '.png')
  writeFileSync(path, Buffer.from(result.data, 'base64'))
  console.log('PASS layout', label, JSON.stringify(layout), 'Screenshot', path)
}
async function key(key, code, virtual, modifiers = 0) {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: virtual, modifiers })
}
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await send('Fetch.enable', { patterns: [{ urlPattern: '*AuthContext.tsx*' }, { urlPattern: '*/v1/*' }, { urlPattern: '*provinces.open-api.vn/*' }, { urlPattern: '*maps.vietmap.vn/api/*' }] })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: origin + '/customer/create' })
  await wait("!!document.querySelector('#shipment-pickupLocation')")
  const liveGeocoding = await evaluate("(async()=>{ const m=await import('/src/features/customer/address-search.ts'); const suggestions=await m.searchAddress('Cầu Giấy, Hà Nội'); if(!suggestions.length) throw new Error('Live VIETMAP search returned no results'); const point=await m.resolveAddressSuggestion(suggestions[0]); const reverse=await m.reverseAddress({lat:21.03,lng:105.8}); return {suggestions:suggestions.length,point:!!point.point,regions:reverse?.address?.regions??[]}; })()")
  assert.ok(liveGeocoding.suggestions > 0 && liveGeocoding.point)
  assert.ok(liveGeocoding.regions.some(region => region.includes('Cầu Giấy')))
  console.log('PASS real browser VIETMAP Search/Place/Reverse (CORS), no local backend required', JSON.stringify(liveGeocoding))
  mockGeocoding = true
  assert.equal(await evaluate("!!document.querySelector('[name=pickupAddress]')"), false)
  assert.equal(await evaluate("!!document.querySelector('[name=senderName]') && !!document.querySelector('[name=senderPhone]')"), true)
  assert.equal(await evaluate("document.querySelector('#shipment-sender-notice').textContent.includes('chưa được gửi')"), true)
  await input('senderName', 'Nguoi gui TEST'); await input('senderPhone', '0912345678')
  await input('recipientName', 'Nguoi nhan TEST'); await input('recipientPhone', '0901234567')
  for (const [width, height] of [[1366, 768], [1280, 720], [1366, 650]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await evaluate('window.scrollTo(0,0)'); await pause(100)
    const parties = await evaluate("Array.from(document.querySelectorAll('.shipment-party-section')).map(e=>{const r=e.getBoundingClientRect();return {name:e.querySelector('legend').textContent,top:r.top,bottom:r.bottom}})")
    assert.equal(parties.length, 2)
    assert.ok(parties.every(section => section.top >= 0 && section.bottom <= height), JSON.stringify({ width, height, parties }))
    const sidebar = await evaluate("(() => {const panel=document.querySelector('.shipment-submit-panel');const r=panel.getBoundingClientRect();const left=document.querySelector('.shipment-party-card').getBoundingClientRect();const button=panel.querySelector('button[type=submit]').getBoundingClientRect();return {left:r.left,right:r.right,contentRight:left.right,buttonBottom:button.bottom,sticky:getComputedStyle(panel).position}})()")
    assert.ok(sidebar.left > sidebar.contentRight && sidebar.right <= width)
    assert.ok(sidebar.buttonBottom <= height)
    assert.equal(sidebar.sticky, 'sticky')
    assert.equal(await evaluate("document.querySelector('[name=senderPhone]').getBoundingClientRect().width < document.querySelector('#shipment-pickupLocation').getBoundingClientRect().width"), true)
    console.log('PASS both parties fully visible', width, height, JSON.stringify(parties))
    await screenshot('compact-create', width, height)
  }
  await evaluate("document.querySelector('[name=senderPhone]').focus()")
  const focus = await evaluate("(() => {const s=getComputedStyle(document.querySelector('[name=senderPhone]'));return {outline:s.outlineWidth,offset:s.outlineOffset,shadow:s.boxShadow,font:s.fontSize}})()")
  assert.equal(focus.outline, '1px'); assert.equal(focus.offset, '-1px'); assert.equal(focus.shadow, 'none')
  assert.ok(parseFloat(focus.font) >= 16)
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.shipment-required')).every(e=>getComputedStyle(e).color==='rgb(185, 28, 28)')"), true)
  await screenshot('compact-focus', 1366, 768)
  await screenshot('create-form', 1440, 900)
  await screenshot('create-form', 375, 812)
  await evaluate("document.querySelector('#shipment-pickupLocation').focus();document.querySelector('#shipment-pickupLocation').click()")
  await wait("!!document.querySelector('dialog[open]')")
  await wait("!document.querySelector('#address-district').disabled")
  assert.equal(await evaluate("document.activeElement.id"), 'address-modal-title')
  await key('Escape', 'Escape', 27)
  await wait("!document.querySelector('dialog')")
  assert.equal(await evaluate('document.activeElement.id'), 'shipment-pickupLocation')
  await evaluate("document.querySelector('#shipment-pickupLocation').click()")
  await wait("!!document.querySelector('dialog[open]')")
  await input('addressStreet', 'Duong Xuan Thuy')
  await input('addressDetails', 'Can ho TEST, cong ben trai')
  assert.equal(await evaluate("document.querySelector('#address-province').disabled"), true)
  assert.equal(tileRequests.length, 0, 'No map tiles before requesting the map')
  await choose('address-district', '5'); await choose('address-ward', '160')
  await screenshot('address-modal', 1440, 900)
  await evaluate("document.querySelector('#address-street').focus()")
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#address-street')).outlineWidth"), '1px')
  await screenshot('address-modal-focus', 1440, 900)
  await screenshot('address-modal', 375, 812)
  await screenshot('address-modal', 812, 375)
  const addressOrder = await evaluate("Array.from(document.querySelectorAll('dialog input,dialog select')).map(e=>e.id)")
  assert.ok(addressOrder.indexOf('address-ward') < addressOrder.indexOf('address-street'))
  const tile = await evaluate("(() => {const e=document.querySelector('.shipment-map-tile');return {width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,inputHeight:document.querySelector('#address-street').getBoundingClientRect().height,text:e.textContent,label:e.getAttribute('aria-label')}})()")
  assert.ok(tile.width >= 44 && tile.width <= 56)
  assert.ok(Math.abs(tile.height - tile.inputHeight) <= 1)
  assert.equal(tile.text, '')
  assert.equal(tile.label, 'Mở bản đồ chọn vị trí')
  await evaluate("document.querySelector('dialog .shipment-address-dialog-footer button[type=submit]').focus()")
  await key('Tab', 'Tab', 9)
  assert.equal(await evaluate("document.querySelector('dialog').contains(document.activeElement)"), true, 'Native modal must contain keyboard focus')
  await evaluate("document.querySelector('#address-modal-pickupLocation-launch').click()")
  await wait("!!document.querySelector('.shipment-map-dialog[open] .leaflet-container')")
  await wait("document.querySelector('.shipment-map-dialog-body > [role=status]').textContent === 'Quận Cầu Giấy'")
  assert.equal(await evaluate("document.querySelector('.shipment-address-dialog:not(.shipment-map-dialog)').contains(document.querySelector('.shipment-map-dialog'))"), false)
  assert.equal(await evaluate("!!document.querySelector('.shipment-map-dialog .leaflet-interactive')"), false, 'Framing district must not select a pin')
  assert.equal(districtLookups.length, 1)
  for (const [width, height] of [[1440, 900], [375, 812], [812, 375]]) {
    await screenshot('map-dialog', width, height)
    const mapLayout = await evaluate("(() => {const d=document.querySelector('.shipment-map-dialog');const bar=d.querySelector('.shipment-map-search').getBoundingClientRect();const label=d.querySelector('.shipment-location-label').getBoundingClientRect();const map=d.querySelector('.leaflet-container').getBoundingClientRect();return {sameRow:bar.top < label.bottom && bar.bottom > label.top,searchWidth:bar.width,searchHeight:bar.height,mapRatio:map.width/map.height}})()")
    assert.equal(mapLayout.sameRow, true)
    assert.ok(mapLayout.searchWidth <= 341 && mapLayout.searchHeight <= 40)
    if (height > 500) assert.ok(mapLayout.mapRatio >= .9 && mapLayout.mapRatio <= 1.6, JSON.stringify(mapLayout))
    const centered = await evaluate("(() => {const r=document.querySelector('.shipment-map-dialog').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight}})()")
    assert.ok(Math.abs(centered.x - centered.w / 2) <= 1 && Math.abs(centered.y - centered.h / 2) <= 1, JSON.stringify(centered))
  }
  await evaluate("document.querySelector('.shipment-map-dialog [aria-label=\"Đóng bản đồ\"]').focus()")
  await key('Tab', 'Tab', 9)
  assert.equal(await evaluate("document.querySelector('.shipment-map-dialog').contains(document.activeElement)"), true)
  await evaluate("void(window.reviewMap=document.querySelector('.leaflet-container'))")
  await key('Escape', 'Escape', 27)
  await wait("!document.querySelector('.shipment-map-dialog').open")
  assert.equal(await evaluate('document.activeElement.id'), 'address-modal-pickupLocation-launch')
  assert.equal(await evaluate("document.querySelector('.shipment-address-dialog:not(.shipment-map-dialog)').open"), true)
  await evaluate("document.querySelector('#address-modal-pickupLocation-launch').click()")
  assert.equal(await evaluate("window.reviewMap===document.querySelector('.leaflet-container')"), true)
  await wait("!!document.querySelector('.leaflet-tile-loaded') && !document.querySelector('[data-map-state]')")
  await evaluate("window.reviewTilePane=document.querySelector('.leaflet-tile-pane')")
  const frameBeforeSelection = await evaluate("(() => {const r=document.querySelector('.shipment-map-dialog').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()")
  const mapTopBeforeSelection = await evaluate("document.querySelector('.leaflet-container').getBoundingClientRect().top")
  heldReverseLookup = new Promise(resolve => { releaseReverseLookup = resolve })
  await evaluate("(() => {const e=document.querySelector('.leaflet-container');e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:e.getBoundingClientRect().x+e.clientWidth/2,clientY:e.getBoundingClientRect().y+e.clientHeight/2}))})()")
  await wait("document.querySelector('.shipment-location-status').textContent === 'Đang lấy địa chỉ…'")
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.shipment-map-dialog p')).filter(e=>e.textContent==='Đang lấy địa chỉ…').length"), 1)
  assert.equal(await evaluate("document.querySelector('.leaflet-container').getBoundingClientRect().top"), mapTopBeforeSelection)
  const frameDuringSelection = await evaluate("(() => {const r=document.querySelector('.shipment-map-dialog').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()")
  assert.deepEqual(frameDuringSelection, frameBeforeSelection)
  releaseReverseLookup(); heldReverseLookup = null
  await wait("document.querySelector('[name=addressStreet]').value === 'Duong Xuan Thuy' && !document.querySelector('dialog button[type=submit]').disabled")
  const frameAfterSelection = await evaluate("(() => {const r=document.querySelector('.shipment-map-dialog').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()")
  assert.deepEqual(frameAfterSelection, frameBeforeSelection, 'Selecting a point and resolving its address must not resize or move the dialog')
  assert.equal(await evaluate("document.querySelector('.leaflet-container').getBoundingClientRect().top"), mapTopBeforeSelection)
  console.log('PASS inline resolving status does not insert a line, move the map or force a new dialog height')
  await evaluate("document.querySelector('.shipment-map-actions button').click()")
  await wait("document.querySelector('[name=addressStreet]').value === 'Duong Xuan Thuy' && !document.querySelector('dialog button[type=submit]').disabled")
  assert.equal(await evaluate("document.querySelector('[name=addressDetails]').value"), 'Can ho TEST, cong ben trai')
  assert.equal(await evaluate("document.querySelector('#address-ward').value"), '160')
  assert.equal(geocoding.length, 1)
  await evaluate("document.querySelector('#address-modal-pickupLocation-launch').click()")
  await wait("!!document.querySelector('.leaflet-tile-loaded') && !document.querySelector('[data-map-state]')")
  assert.equal(await evaluate("window.reviewTilePane===document.querySelector('.leaflet-tile-pane')"), true)
  await screenshot('carto-ready', 1440, 900)
  assert.equal(await evaluate("document.querySelector('.leaflet-control-attribution').textContent.includes('OpenStreetMap')"), true)
  assert.equal(await evaluate("document.querySelector('.leaflet-control-attribution').textContent.includes('CARTO')"), true)
  assert.ok(tileRequests.length > 0)
  assert.deepEqual(tileFailures, [])
  console.log('PASS real CARTO raster rendering, attribution and retained tile layer', tileRequests.length, 'tile requests; keys redacted')
  await evaluate("window.reviewMap=document.querySelector('.leaflet-container');document.querySelector('.shipment-map-dialog [aria-label=\"Đóng bản đồ\"]').click()")
  await evaluate("document.querySelector('#address-modal-pickupLocation-launch').click()")
  await pause(300)
  assert.equal(await evaluate("window.reviewMap === document.querySelector('.leaflet-container')"), true)
  await evaluate("document.querySelector('.shipment-map-dialog [aria-label=\"Đóng bản đồ\"]').click()")
  await input('addressDetails', 'Can ho TEST updated')
  assert.equal(geocoding.length, 1)
  await input('addressStreet', 'Duong TEST updated')
  await evaluate("document.querySelector('#address-modal-pickupLocation-launch').click()")
  await wait("!!Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent==='Xác nhận điểm đã chọn')")
  await evaluate("Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent==='Xác nhận điểm đã chọn').click()")
  await evaluate("document.querySelector('.shipment-map-dialog [aria-label=\"Đóng bản đồ\"]').click()")
  await evaluate("document.querySelector('dialog form').requestSubmit()")
  await wait("!document.querySelector('dialog')")
  assert.equal(posts.length, 0, 'Saving an address must never submit an order')
  assert.equal(await evaluate('document.activeElement.id'), 'shipment-pickupLocation')
  assert.equal(await evaluate("document.querySelector('#shipment-pickupLocation').textContent.includes('Can ho TEST updated')"), true)
  await evaluate("document.querySelector('#shipment-pickupLocation').click()")
  await wait("!!document.querySelector('#address-ward')")
  assert.equal(await evaluate("document.querySelector('#address-ward').value"), '160')
  await key('Escape', 'Escape', 27); await wait("!document.querySelector('dialog')")
  console.log('PASS hierarchy, map selection, private details, manual address confirmation, save/reopen/Escape and focus restoration')
  await evaluate("document.querySelector('#shipment-dropoffLocation').click()")
  await wait("!!document.querySelector('dialog')")
  await input('addressDetails', 'Cong TEST')
  await choose('address-district', '5'); await choose('address-ward', '160')
  await evaluate("document.querySelector('#address-modal-dropoffLocation-launch').click()")
  await wait("!!document.querySelector('.shipment-map-actions button')")
  await evaluate("(() => {const e=document.querySelector('.leaflet-container');e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:e.getBoundingClientRect().x+e.clientWidth/2,clientY:e.getBoundingClientRect().y+e.clientHeight/2}))})()")
  await evaluate("document.querySelector('.shipment-map-actions button').click()")
  await wait("document.querySelector('#address-street').value === 'Duong Xuan Thuy' && !document.querySelector('dialog button[type=submit]').disabled")
  assert.equal(await evaluate("!!document.querySelector('#address-area') || !!document.querySelector('.shipment-address-dialog input[type=checkbox]')"), false)
  await evaluate("document.querySelector('dialog form').requestSubmit()")
  await wait("!document.querySelector('dialog')")
  await input('recipientName', 'Nguoi nhan TEST'); await input('recipientPhone', '0901234567')
  await input('senderName', 'Nguoi gui TEST'); await input('senderPhone', '0912345678')
  await evaluate("document.querySelector('.shipment-create-card').requestSubmit()")
  await wait("document.body.textContent.includes('POST /v1/shipments, HTTP 404')")
  const errorStyle = await evaluate("(() => {const e=document.querySelector('.customer-error');const s=getComputedStyle(e);return {border:s.borderLeftWidth,radius:s.borderRadius,outline:s.outlineStyle,background:s.backgroundColor,font:getComputedStyle(e.querySelector('h2')).fontSize}})()")
  assert.equal(errorStyle.border, '0px'); assert.equal(errorStyle.radius, '0px'); assert.equal(errorStyle.background, 'rgba(0, 0, 0, 0)')
  assert.ok(parseFloat(errorStyle.font) <= 14)
  assert.equal(errorStyle.outline, 'none')
  for (const [width, height] of [[1366, 768], [375, 812], [812, 375]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    const addresses = await evaluate("Array.from(document.querySelectorAll('.shipment-address-trigger')).map(button=>{const value=button.querySelector('span');const s=getComputedStyle(value);return {nowrap:s.whiteSpace,overflow:s.overflow,textOverflow:s.textOverflow,height:value.getBoundingClientRect().height,lineHeight:parseFloat(s.lineHeight),title:button.title,text:value.textContent}})")
    assert.equal(addresses.length, 2)
    assert.ok(addresses.every(address => address.nowrap === 'nowrap' && address.overflow === 'hidden' && address.textOverflow === 'ellipsis' && address.height <= address.lineHeight + 1 && address.title === address.text), JSON.stringify(addresses))
    await screenshot('single-line-address', width, height)
  }
  await evaluate('window.scrollTo(0,0)')
  await screenshot('compact-error', 1366, 768)
  assert.equal(posts.length, 1)
  assert.equal(Object.hasOwn(posts[0], 'senderName'), false)
  assert.equal(Object.hasOwn(posts[0], 'senderPhone'), false)
  assert.ok(!String(posts[0].notes).includes('Nguoi gui TEST'))
  assert.equal(posts[0].pickupAddress, 'Can ho TEST updated, Duong TEST updated, Phường Quan Hoa, Quận Cầu Giấy, Thành phố Hà Nội')
  assert.equal(await evaluate("document.querySelector('#shipment-pickupLocation').disabled"), false)
  assert.equal(await evaluate("document.body.textContent.includes('Yêu cầu bị từ chối')"), false)
  assert.equal(await evaluate("new Set(Array.from(document.querySelectorAll('[id]')).map(e=>e.id)).size === document.querySelectorAll('[id]').length"), true)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.deepEqual(errors, [])
  console.log('PASS map-first alternative, unchanged API payload, 404 retained draft, no JS errors or duplicate IDs')
  reviewRole = 'ADMIN'
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Page.navigate', { url: origin + '/admin/live-map' })
  await wait("document.querySelectorAll('.driver-map-marker').length===5 && !!document.querySelector('.leaflet-tile-loaded') && !document.querySelector('[data-map-state]')")
  assert.equal(await evaluate("document.querySelector('.leaflet-control-attribution').textContent.includes('OpenStreetMap')"), true)
  await evaluate("document.querySelectorAll('.driver-map-card')[1].click()")
  await wait("document.querySelectorAll('.driver-map-card')[1].getAttribute('aria-pressed')==='true'")
  for (const [width, height] of [[1440,900],[375,812]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await pause(250)
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(tmpdir(), 'parcelflow-carto-admin-' + width + '.png'), Buffer.from(shot.data, 'base64'))
  }
  assert.deepEqual(errors, [])
  console.log('PASS Admin CARTO tiles, attribution, five demo markers, driver selection, desktop/mobile')
  console.log('Local browser: real CARTO tiles and VIETMAP CORS smoke; UI race tests mock VIETMAP/directory; Auth mocked, no real shipments')
} finally {
  await send('Page.close').catch(() => {})
  socket.close()
}
