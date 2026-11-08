import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { assertGpsLocationRequest } from '../../../packages/types/src/gps.ts'
import { shipmentFixture } from '../src/features/customer/shipment-fixture.ts'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.DRIVER_REVIEW_PLAYWRIGHT || 'playwright')
const { createServer } = await import('vite')
const repo = fileURLToPath(new URL('../../../', import.meta.url))
const web = path.join(repo, 'apps/web')
const fixture = path.join(web, '.vitest/driver-dashboard-review')
const output = path.resolve(process.env.DRIVER_REVIEW_OUTPUT || path.join(repo, '.vitest/driver-dashboard-review'))
const origin = 'http://127.0.0.1:5179'
const errors = []
const externalRequests = []
const checks = []
let server
let browser

async function eventually(check) {
  const deadline = Date.now() + 5000
  for (;;) {
    try { return await check() }
    catch (error) {
      if (Date.now() >= deadline) throw error
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

async function text(page) { return page.locator('body').innerText() }
async function contains(page, value) { await eventually(async () => assert.ok((await text(page)).includes(value), value)) }
async function check(name, run) { await run(); checks.push(name); console.log(`PASS ${name}`) }

const fixtureSource = `
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { AuthContext } from '../../src/features/auth/context'
import { setTokenReader } from '../../src/features/auth/session'
import { ProtectedRoute } from '../../src/features/auth/ProtectedRoute'
import { DriverLayout } from '../../src/layouts/DriverLayout'
import { DriverPlaceholderPage } from '../../src/features/driver/DriverPlaceholderPage'
import { DriverShipmentDetailPage } from '../../src/features/driver/DriverShipmentDetailPage'
import '../../src/index.css'
import '../../src/components/ui/ui.css'
import '../../src/features/auth/auth.css'
import '../../src/dark-dashboard.css'
setTokenReader(async () => 'local-review-token')
export function Review() {
  const params = new URLSearchParams(location.search)
  const [user, setUser] = useState(params.has('signedout') ? null : {
    id: 'driver-review-uid', email: 'driver@example.test',
    displayName: params.has('long') ? 'Driver'.repeat(30) : 'Tài xế thử',
    role: params.get('role') || 'DRIVER',
  })
  return <AuthContext.Provider value={{ user, token: user ? 'local-review-token' : null,
    loading: false, error: null, login: async () => {}, refresh: async () => {},
    logout: async () => setUser(null) }}>
    <MemoryRouter initialEntries={[params.has('detail') ? '/driver/shipments/${shipmentFixture.id}' : '/driver']}>
      <p style={{ padding: 8, overflowWrap: 'anywhere' }}>Local review: Auth và API được giả lập.</p>
      <div className="app-experience"><Routes>
        <Route path="/login" element={<h1>Đăng nhập thử</h1>} />
        <Route path="/other" element={<h1>Đã rời trang Driver</h1>} />
        <Route path="/driver" element={<ProtectedRoute role="DRIVER"><DriverLayout /></ProtectedRoute>}>
          <Route index element={<DriverPlaceholderPage />} />
          <Route path="shipments/:id" element={<DriverShipmentDetailPage />} />
        </Route>
      </Routes></div>
      <aside style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Link to="/other">Rời trang thử</Link>
        <button onClick={() => setUser({ id: 'second-driver', email: 'second@example.test',
          displayName: 'Tài xế thứ hai', role: 'DRIVER' })}>Đổi tài khoản thử</button>
      </aside>
    </MemoryRouter>
  </AuthContext.Provider>
}
createRoot(document.getElementById('root')).render(<StrictMode><Review /></StrictMode>)
`

async function reviewPage({ width = 390, height = 844, query = '', mode = 'accepted', shipmentMode = 'accepted', geolocation, permissions = [] } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block',
    geolocation, permissions })
  const page = await context.newPage()
  const sent = []
  const aborted = []
  const shipmentRequests = []
  const shipmentAborted = []
  let currentShipment = { ...shipmentFixture, driverId: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX',
    status: shipmentMode === 'picked' || shipmentMode === 'deliver-pending' ? 'PICKED_UP' : 'ASSIGNED' }
  let failReads = false
  page.on('pageerror', error => errors.push(error.message))
  page.on('requestfailed', request => {
    if (request.url() === `${origin}/v1/locations`) aborted.push(request.failure()?.errorText)
    if (/\/v1\/shipments\/.+\/(pickup|deliver)$/.test(request.url())) shipmentAborted.push(request.failure()?.errorText)
  })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) { externalRequests.push(url.origin); await route.abort(); return }
    if (url.pathname.startsWith('/v1/shipments')) {
      assert.equal(request.headers().authorization, 'Bearer local-review-token')
      shipmentRequests.push({ method: request.method(), path: url.pathname + url.search, body: request.postDataJSON() })
      let status = 200
      let body
      if (request.method() === 'GET') {
        if (failReads || shipmentMode === 'read-error') { status = 503; body = { code: 'SERVICE_UNAVAILABLE' } }
        else if (url.pathname === '/v1/shipments') body = { data: shipmentMode === 'empty' ? [] : [currentShipment],
          pagination: { limit: 20, hasMore: false, nextCursor: null } }
        else body = { ...currentShipment, statusHistory: [] }
      } else {
        assert.equal(request.method(), 'POST')
        assert.ok(/\/(pickup|deliver)$/.test(url.pathname))
        if (shipmentMode === 'pending' || shipmentMode === 'deliver-pending') return
        if (shipmentMode === 'unsupported') { status = 404; body = { code: 'NOT_FOUND' } }
        else if (shipmentMode === 'invalid') body = { status: 'OK' }
        else if (url.pathname.endsWith('/pickup')) {
          assert.equal(request.postData(), null)
          currentShipment = { ...currentShipment, status: 'PICKED_UP' }
          body = currentShipment
          if (shipmentMode === 'conflict') { status = 409; body = { code: 'INVALID_STATE_TRANSITION' } }
        } else {
          const payload = request.postDataJSON()
          assert.ok(Object.keys(payload).every(key => key === 'proofOfDeliveryNotes'))
          currentShipment = { ...currentShipment, status: 'DELIVERED', proofOfDeliveryNotes: payload.proofOfDeliveryNotes || null }
          body = currentShipment
        }
        if (shipmentMode === 'confirmed-read-error') failReads = true
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
      return
    }
    if (url.pathname !== '/v1/locations') { await route.continue(); return }
    assert.equal(request.method(), 'POST')
    assert.equal(request.headers().authorization, 'Bearer local-review-token')
    const payload = request.postDataJSON()
    assertGpsLocationRequest(payload)
    assert.deepEqual(Object.keys(payload).sort(), ['clientTimestamp', 'lat', 'lng', 'seq'])
    sent.push(payload)
    if (mode === 'pending') return
    if (mode === 'network') { await route.abort('failed'); return }
    const body = mode === 'invalid' ? { status: 'OK' } : typeof mode === 'number'
      ? { code: 'REVIEW_REJECTED', detail: 'private server details' }
      : { status: 'ACCEPTED', eventId: 'gps-browser-review', receivedAt: new Date().toISOString() }
    await route.fulfill({ status: typeof mode === 'number' ? mode : 202, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.clock.install({ time: new Date('2026-11-02T01:00:00.000Z') })
  await page.clock.pauseAt(new Date('2026-11-02T01:00:01.000Z'))
  await page.goto(`${origin}/.vitest/driver-dashboard-review/index.html${query}`)
  await page.locator('h1').first().waitFor()
  return { page, sent, context, aborted, shipmentRequests, shipmentAborted }
}

async function start(page) { await page.getByRole('button', { name: 'Bắt đầu phát mẫu', exact: true }).click() }
async function stop(page) { await page.getByRole('button', { name: 'Dừng', exact: true }).click() }
async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'horizontal page overflow')
}

try {
  await mkdir(fixture, { recursive: true })
  await mkdir(output, { recursive: true })
  await writeFile(path.join(fixture, 'fixture.tsx'), fixtureSource)
  await writeFile(path.join(fixture, 'index.html'), '<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Driver dashboard local review</title></head><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>')
  server = await createServer({ root: web, configFile: path.join(web, 'vite.config.ts'),
    clearScreen: false, logLevel: 'error', define: { 'import.meta.env.VITE_API_URL': JSON.stringify(`${origin}/v1`) },
    server: { host: '127.0.0.1', port: 5179, strictPort: true } })
  await server.listen()
  browser = await chromium.launch({ channel: process.env.DRIVER_REVIEW_CHANNEL || 'msedge', headless: true })

  for (const width of [320, 390, 1440]) {
    await check(`layout ${width}px and long account name`, async () => {
      const { page, context, sent } = await reviewPage({ width, query: '?long=1' })
      try {
        await noOverflow(page)
        await page.clock.runFor(16000)
        assert.equal(sent.length, 0)
        assert.equal(await page.getByRole('button', { name: 'Dừng', exact: true }).isDisabled(), true)
        await page.screenshot({ path: path.join(output, `layout-${width}.png`), fullPage: true })
      } finally { await context.close() }
    })
  }
  await check('keyboard skip link reaches main content', async () => {
    const { page, context } = await reviewPage()
    try {
      await page.keyboard.press('Tab')
      assert.equal(await page.locator(':focus').textContent(), 'Đến nội dung chính')
      await page.keyboard.press('Enter')
      assert.equal(await page.locator(':focus').getAttribute('id'), 'driver-main')
    } finally { await context.close() }
  })
  await check('eight-second cadence, acceptance, Stop and restart sequence', async () => {
    const { page, context, sent } = await reviewPage()
    try {
      await start(page)
      await page.clock.runFor(7999)
      assert.equal(sent.length, 0)
      await page.clock.runFor(1)
      await contains(page, 'Số mẫu được API chấp nhận: 1')
      assert.equal(sent[0].seq, 1)
      await contains(page, 'gps-browser-review')
      await stop(page)
      await page.clock.runFor(16000)
      assert.equal(sent.length, 1)
      await start(page)
      await page.clock.runFor(8000)
      await contains(page, 'Số mẫu được API chấp nhận: 2')
      assert.equal(sent[1].seq, 2)
      assert.notDeepEqual([sent[0].lat, sent[0].lng], [sent[1].lat, sent[1].lng])
      await stop(page)
      await noOverflow(page)
      await page.screenshot({ path: path.join(output, 'accepted-stopped.png'), fullPage: true })
    } finally { await context.close() }
  })
  await check('native browser geolocation, measured timestamp and changing coordinates', async () => {
    const { page, context, sent } = await reviewPage({ geolocation: { latitude: 10.762622, longitude: 106.660172 },
      permissions: ['geolocation'] })
    try {
      await page.evaluate(() => {
        const getPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
        navigator.geolocation.getCurrentPosition = (success, error, options) => getPosition(position => {
          window.driverReviewMeasuredAt = position.timestamp
          success(position)
        }, error, options)
      })
      await page.getByLabel('Chọn nguồn vị trí').selectOption('browser')
      await page.clock.runFor(16000)
      assert.equal(sent.length, 0)
      await start(page)
      assert.equal(await page.getByLabel('Chọn nguồn vị trí').isDisabled(), true)
      await page.clock.runFor(8000)
      await contains(page, 'Số mẫu được API chấp nhận: 1')
      assert.deepEqual([sent[0].lat, sent[0].lng], [10.762622, 106.660172])
      const measuredAt = await page.evaluate(() => window.driverReviewMeasuredAt)
      assert.equal(sent[0].clientTimestamp, new Date(measuredAt).toISOString())
      await context.setGeolocation({ latitude: 10.763, longitude: 106.661 })
      await page.clock.runFor(8000)
      await contains(page, 'Số mẫu được API chấp nhận: 2')
      assert.deepEqual([sent[1].lat, sent[1].lng], [10.763, 106.661])
      await stop(page)
      await noOverflow(page)
      await page.screenshot({ path: path.join(output, 'browser-position.png'), fullPage: true })
    } finally { await context.close() }
  })
  await check('native browser denies geolocation and requires an explicit simulator choice', async () => {
    const { page, context, sent } = await reviewPage()
    try {
      await context.grantPermissions([], { origin })
      assert.equal(await page.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state), 'denied')
      await page.getByLabel('Chọn nguồn vị trí').selectOption('browser')
      await start(page)
      await page.clock.runFor(8000)
      await contains(page, 'Chưa được cấp quyền')
      await contains(page, 'Đã dừng')
      assert.equal(sent.length, 0)
      assert.equal(await page.getByLabel('Chọn nguồn vị trí').inputValue(), 'browser')
      await page.screenshot({ path: path.join(output, 'browser-permission-denied.png'), fullPage: true })
      await page.getByLabel('Chọn nguồn vị trí').selectOption('simulator')
      await start(page)
      await page.clock.runFor(8000)
      await contains(page, 'Số mẫu được API chấp nhận: 1')
    } finally { await context.close() }
  })
  await check('browser acquisition deadline ignores a late callback after restart', async () => {
    const { page, context, sent } = await reviewPage()
    try {
      await page.evaluate(() => {
        navigator.geolocation.getCurrentPosition = success => { window.driverReviewPosition = success }
      })
      await page.getByLabel('Chọn nguồn vị trí').selectOption('browser')
      await start(page)
      await page.clock.runFor(8000)
      await contains(page, 'Đang lấy vị trí')
      await page.clock.runFor(7000)
      await contains(page, 'Chưa lấy được vị trí trong 7 giây')
      await start(page)
      await page.evaluate(() => window.driverReviewPosition({ coords: { latitude: 10, longitude: 106 }, timestamp: Date.now() }))
      assert.equal(sent.length, 0)
      await stop(page)
    } finally { await context.close() }
  })
  for (const action of ['Dừng', 'Rời trang thử', 'Đăng xuất', 'Đổi tài khoản thử']) {
    await check(`pending geolocation cleanup: ${action}`, async () => {
      const { page, context, sent } = await reviewPage()
      try {
        await page.evaluate(() => {
          navigator.geolocation.getCurrentPosition = success => { window.driverReviewPosition = success }
        })
        await page.getByLabel('Chọn nguồn vị trí').selectOption('browser')
        await start(page)
        await page.clock.runFor(8000)
        await contains(page, 'Đang lấy vị trí')
        await page.getByRole(action === 'Rời trang thử' ? 'link' : 'button', { name: action, exact: true }).click()
        await page.evaluate(() => window.driverReviewPosition({ coords: { latitude: 10, longitude: 106 }, timestamp: Date.now() }))
        await page.clock.runFor(16000)
        assert.equal(sent.length, 0)
        assert.ok(!(await text(page)).includes('Đang lấy vị trí'))
      } finally { await context.close() }
    })
  }
  for (const [mode, message] of [[401, 'đăng nhập lại'], [403, 'không có quyền'], [404, 'chưa sẵn sàng'],
    [409, 'kiểm tra dịch vụ'], [503, 'kiểm tra dịch vụ'], ['invalid', 'chưa đúng định dạng'], ['network', 'Không kết nối được']]) {
    await check(`rejection ${mode} is visible and not counted`, async () => {
      const { page, context } = await reviewPage({ mode })
      try {
        await start(page)
        await page.clock.runFor(8000)
        await contains(page, message)
        await contains(page, 'Số mẫu được API chấp nhận: 0')
        assert.ok(!(await text(page)).includes('private server details'))
        await stop(page)
      } finally { await context.close() }
    })
  }
  await check('seven-second timeout without automatic retry', async () => {
    const { page, context, sent, aborted } = await reviewPage({ mode: 'pending' })
    try {
      await start(page)
      await page.clock.runFor(8000)
      await eventually(() => assert.equal(sent.length, 1))
      await stop(page)
      await page.clock.runFor(7000)
      await contains(page, 'Không tự gửi lại')
      await eventually(() => assert.deepEqual(aborted, ['net::ERR_ABORTED']))
      await page.clock.runFor(16000)
      assert.equal(sent.length, 1)
    } finally { await context.close() }
  })
  for (const action of ['Rời trang thử', 'Đăng xuất', 'Đổi tài khoản thử']) {
    await check(`pending request cleanup: ${action}`, async () => {
      const { page, context, sent, aborted } = await reviewPage({ mode: 'pending' })
      try {
        await start(page)
        await page.clock.runFor(8000)
        await eventually(() => assert.equal(sent.length, 1))
        await page.getByRole(action === 'Rời trang thử' ? 'link' : 'button', { name: action, exact: true }).click()
        await contains(page, action === 'Đăng xuất' ? 'Đăng nhập thử' : action === 'Rời trang thử' ? 'Đã rời trang Driver' : 'Xin chào, Tài xế thứ hai')
        await eventually(() => assert.deepEqual(aborted, ['net::ERR_ABORTED']))
        await page.clock.runFor(24000)
        assert.equal(sent.length, 1)
        if (action === 'Đổi tài khoản thử') await contains(page, 'Số mẫu được API chấp nhận: 0')
      } finally { await context.close() }
    })
  }
  for (const query of ['?role=CUSTOMER', '?role=ADMIN', '?signedout=1']) {
    await check(`route access ${query}`, async () => {
      const { page, context, sent } = await reviewPage({ query })
      try {
        await contains(page, query.includes('signedout') ? 'Đăng nhập thử' : 'Không có quyền truy cập')
        assert.equal(await page.getByRole('button', { name: 'Bắt đầu phát mẫu', exact: true }).count(), 0)
        await page.clock.runFor(16000)
        assert.equal(sent.length, 0)
      } finally { await context.close() }
    })
  }
  for (const width of [320, 390, 1440]) {
    await check(`assigned shipment list and detail layout ${width}px`, async () => {
      const { page, context } = await reviewPage({ width })
      try {
        await contains(page, shipmentFixture.trackingNumber)
        await noOverflow(page)
        await page.screenshot({ path: path.join(output, `shipments-${width}.png`), fullPage: true })
        await page.getByRole('link', { name: 'Xem đơn ' + shipmentFixture.trackingNumber, exact: true }).click()
        await page.getByRole('button', { name: 'Đã lấy hàng', exact: true }).waitFor()
        await contains(page, shipmentFixture.recipientPhone)
        await noOverflow(page)
        await page.screenshot({ path: path.join(output, `shipment-detail-${width}.png`), fullPage: true })
      } finally { await context.close() }
    })
  }
  for (const shipmentMode of ['empty', 'read-error']) {
    await check(`shipment list ${shipmentMode}`, async () => {
      const { page, context } = await reviewPage({ shipmentMode })
      try { await contains(page, shipmentMode === 'empty' ? 'Chưa có đơn trên trang này' : 'Chưa kết nối được máy chủ') }
      finally { await context.close() }
    })
  }
  await check('Driver pickup and delivery confirmation with real adapters and API mocks', async () => {
    const { page, context, shipmentRequests } = await reviewPage({ query: '?detail=1' })
    try {
      await page.getByRole('button', { name: 'Đã lấy hàng', exact: true }).click()
      assert.equal(shipmentRequests.filter(request => request.method === 'POST').length, 0)
      await page.getByRole('button', { name: 'Hủy xác nhận', exact: true }).click()
      await page.getByRole('button', { name: 'Đã lấy hàng', exact: true }).click()
      await page.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true }).click()
      await contains(page, 'Máy chủ đã xác nhận lấy hàng')
      await page.getByLabel('Ghi chú giao hàng (không bắt buộc)').fill('  Gửi lễ tân  ')
      await page.getByRole('button', { name: 'Giao thành công', exact: true }).click()
      await page.screenshot({ path: path.join(output, 'delivery-confirmation.png'), fullPage: true })
      await page.getByRole('button', { name: 'Xác nhận giao thành công', exact: true }).click()
      await contains(page, 'Máy chủ đã xác nhận giao thành công')
      await contains(page, 'Gửi lễ tân')
      assert.deepEqual(shipmentRequests.filter(request => request.method === 'POST').map(request => request.body), [null, { proofOfDeliveryNotes: 'Gửi lễ tân' }])
      assert.equal(await page.getByRole('button', { name: 'Giao thành công', exact: true }).count(), 0)
    } finally { await context.close() }
  })
  for (const shipmentMode of ['unsupported', 'conflict', 'invalid', 'confirmed-read-error']) {
    await check(`Driver action recovery ${shipmentMode} without automatic POST retry`, async () => {
      const { page, context, shipmentRequests } = await reviewPage({ query: '?detail=1', shipmentMode })
      try {
        await page.getByRole('button', { name: 'Đã lấy hàng', exact: true }).click()
        await page.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true }).click()
        await contains(page, shipmentMode === 'confirmed-read-error' ? 'Chưa tải được thông tin bổ sung' : 'Đã đọc lại trạng thái hiện tại')
        assert.equal(shipmentRequests.filter(request => request.method === 'POST').length, 1)
        if (shipmentMode !== 'confirmed-read-error') assert.ok(!(await text(page)).includes('Máy chủ đã xác nhận'))
        else assert.equal(await page.getByRole('button', { name: 'Giao thành công', exact: true }).count(), 0)
      } finally { await context.close() }
    })
  }
  for (const action of ['Rời trang thử', 'Đăng xuất', 'Đổi tài khoản thử']) {
    await check(`Driver pending pickup cleanup: ${action}`, async () => {
      const { page, context, shipmentRequests, shipmentAborted } = await reviewPage({ query: '?detail=1', shipmentMode: 'pending' })
      try {
        await page.getByRole('button', { name: 'Đã lấy hàng', exact: true }).click()
        await page.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true }).click()
        await eventually(() => assert.equal(shipmentRequests.filter(request => request.method === 'POST').length, 1))
        await page.getByRole(action === 'Rời trang thử' ? 'link' : 'button', { name: action, exact: true }).click()
        await eventually(() => assert.deepEqual(shipmentAborted, ['net::ERR_ABORTED']))
        assert.ok(!(await text(page)).includes('Máy chủ đã xác nhận'))
      } finally { await context.close() }
    })
  }
  assert.deepEqual(errors, [], 'browser runtime errors')
  assert.deepEqual(externalRequests, [], 'unexpected external requests')
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim()
  const sourceFiles = ['apps/web/src/features/driver/DriverPlaceholderPage.tsx', 'apps/web/src/features/driver/GpsEmitter.tsx',
    'apps/web/src/features/driver/driver.css', 'apps/web/src/layouts/DriverLayout.tsx',
    'apps/web/src/api/client.ts', 'apps/web/src/api/endpoints/locations.ts', 'apps/web/scripts/verify-driver-dashboard.mjs',
    'apps/web/src/features/driver/DriverShipments.tsx', 'apps/web/src/features/driver/DriverShipmentDetailPage.tsx',
    'apps/web/src/features/driver/driver-shipment-error.ts', 'apps/web/src/api/endpoints/shipments.ts', 'apps/web/src/App.tsx']
  const sourceSha256 = Object.fromEntries(await Promise.all(sourceFiles.map(async file =>
    [file, createHash('sha256').update(await readFile(path.join(repo, file))).digest('hex')])))
  const report = { status: 'PASS', generatedAt: new Date().toISOString(), sourceRevision,
    browser: `Microsoft Edge ${browser.version()}`, level: 'local-browser-with-auth-and-api-mocks', checks,
    runtimeErrors: errors, externalRequests, cloudGpsPublished: false,
    uncommittedChanges: !!execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim(),
    sourceFiles, sourceSha256 }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS ${checks.length} browser scenarios; evidence: ${output}`)
} catch (error) {
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ status: 'FAIL', checks, message: error.message, runtimeErrors: errors, externalRequests }, null, 2) + '\n')
  throw error
} finally {
  await browser?.close()
  await server?.close()
  await rm(path.join(fixture, 'fixture.tsx'), { force: true })
  await rm(path.join(fixture, 'index.html'), { force: true })
  await rmdir(fixture)
}
