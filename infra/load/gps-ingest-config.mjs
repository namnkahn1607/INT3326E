function positive(env, name, fallback, integer = false) {
  const raw = env[name] === undefined ? String(fallback) : env[name]
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(raw)) throw new Error(`${name} must be a positive ${integer ? 'integer' : 'number'}`)
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0 || integer && !Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a positive ${integer ? 'integer' : 'number'}`)
  }
  return value
}

export function readConfig(env) {
  const match = /^(https?):\/\/(\[[0-9a-f:]+\]|[^/?#:@\s]+)(?::(\d{1,5}))?\/v1\/?$/i.exec(env.BASE_URL || '')
  if (!match || match[3] && (Number(match[3]) < 1 || Number(match[3]) > 65535)) {
    throw new Error('BASE_URL must be an HTTP(S) API base ending in /v1, without credentials, query or fragment')
  }
  if (!env.DRIVER_TOKENS_FILE?.trim()) throw new Error('DRIVER_TOKENS_FILE is required')
  const config = {
    baseUrl: env.BASE_URL.replace(/\/$/, ''),
    drivers: positive(env, 'DRIVERS', 2, true),
    intervalSeconds: positive(env, 'SEND_INTERVAL_SECONDS', 8),
    durationSeconds: positive(env, 'DURATION_SECONDS', 16, true),
    timeoutSeconds: positive(env, 'REQUEST_TIMEOUT_SECONDS', 7),
    tokenFile: env.DRIVER_TOKENS_FILE,
    summaryPath: env.SUMMARY_PATH || 'gps-ingest-summary.json',
  }
  if (!config.summaryPath.trim()) throw new Error('SUMMARY_PATH must not be blank')
  if (config.intervalSeconds < 0.001) throw new Error('SEND_INTERVAL_SECONDS must be at least 0.001 for millisecond GPS timestamps')
  return config
}

export function selectTokens(values, config, decodeClaims, now = Date.now()) {
  if (!Array.isArray(values) || values.length < config.drivers) throw new Error('Token file must contain at least DRIVERS entries')
  const subjects = new Set()
  return values.slice(0, config.drivers).map((token, index) => {
    let claims
    try {
      if (typeof token !== 'string' || token.trim() !== token || token.split('.').length !== 3) throw new Error()
      claims = decodeClaims(token.split('.')[1])
    } catch { throw new Error(`Driver token entry ${index + 1} is not a JWT`) }
    if (typeof claims?.sub !== 'string' || !claims.sub.trim() || claims.role !== 'DRIVER') {
      throw new Error(`Driver token entry ${index + 1} must have sub and DRIVER role`)
    }
    if (subjects.has(claims.sub)) throw new Error('Selected tokens must belong to distinct Driver accounts')
    subjects.add(claims.sub)
    const requiredUntil = now / 1000 + config.durationSeconds + config.timeoutSeconds + 30
    if (!Number.isFinite(claims.exp) || claims.exp <= requiredUntil) {
      throw new Error(`Driver token entry ${index + 1} expires before the test can finish`)
    }
    return token
  })
}

export function createSample(driverIndex, seq, timestamp) {
  if (!Number.isInteger(seq) || seq < 1 || seq > 2147483647) throw new Error('GPS sequence exceeds the API08 range')
  const offset = (driverIndex % 100) * 0.0001 + (seq % 4) * 0.00001
  return { lat: 21.0285 + offset, lng: 105.8048 + offset, seq, clientTimestamp: new Date(timestamp).toISOString() }
}

export function isAccepted(status, body) {
  return status === 202 && !!body && typeof body === 'object' && body.status === 'ACCEPTED' &&
    typeof body.eventId === 'string' && !!body.eventId.trim() &&
    typeof body.receivedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(body.receivedAt) &&
    Number.isFinite(Date.parse(body.receivedAt)) && new Date(body.receivedAt).toISOString() === body.receivedAt
}
