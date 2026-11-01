import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const requireApi = createRequire(resolve(process.cwd(), '../api/package.json'))
requireApi('reflect-metadata')
const { Test } = requireApi('@nestjs/testing')
const { PGlite } = requireApi('@electric-sql/pglite')
const { AppModule } = requireApi('./dist/app.module.js')
const { configureApp } = requireApi('./dist/config/app.config.js')
const { FIREBASE_AUTH } = requireApi('./dist/modules/auth/providers/firebase-auth.provider.js')
const { USER_DATABASE } = requireApi('./dist/modules/users/user-database.provider.js')

export const userId = n => 'usr_' + String(n).padStart(26, '0')
const users = {
  customer: [1, 'CUSTOMER'], other: [2, 'CUSTOMER'],
  driver1: [3, 'DRIVER'], driver2: [4, 'DRIVER'], admin: [5, 'ADMIN'],
}

export async function startServer() {
  const database = new PGlite()
  let app
  let failAssignment = false
  let tail = Promise.resolve()
  async function acquire() {
    const previous = tail
    let release
    tail = new Promise(resolve => { release = resolve })
    await previous
    return release
  }
  const query = async (sql, params = []) => {
    const release = await acquire()
    try { return await database.query(sql, params) } finally { release() }
  }
  const adapter = {
    query,
    end: async () => {},
    connect: async () => {
      const release = await acquire()
      return { query: (sql, params = []) => {
        if (failAssignment && sql.startsWith('UPDATE shipments')) {
          failAssignment = false
          throw new Error('Isolated assignment write failure')
        }
        return database.query(sql, params)
      }, release }
    },
  }
  try {
    const sql = await readFile(resolve(process.cwd(), '../../packages/database/sql/001-create-shipment.sql'), 'utf8')
    await database.exec(sql)
    await database.exec(`CREATE TABLE current_locations (
      "driverId" text PRIMARY KEY REFERENCES users(id), lat double precision,
      lng double precision, "receivedAt" timestamptz, "clientTimestamp" timestamptz
    )`)
    for (const [uid, [n, role]] of Object.entries(users)) {
      await query('INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,$2,$3,$4,$5)',
        [userId(n), uid, `${uid}@example.com`, uid, role])
    }
    const claims = token => {
      if (!Object.hasOwn(users, token)) throw new Error('Invalid test identity')
      return { uid: token, role: users[token][1] }
    }
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({
        verifyIdToken: async token => claims(token),
        getUser: async uid => ({ disabled: false, customClaims: { role: claims(uid).role } }),
      }).overrideProvider(USER_DATABASE).useValue(adapter).compile()
    app = module.createNestApplication({ logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    return {
      base: `${await app.getUrl()}/v1`,
      query,
      failNextAssignment: () => { failAssignment = true },
      reset: () => {
        failAssignment = false
        return query('TRUNCATE idempotency_requests, notifications, shipment_status_events, shipments')
      },
      close: async () => { try { await app.close() } finally { await database.close() } },
    }
  } catch (error) {
    try { await app?.close() } finally { await database.close() }
    throw error
  }
}
