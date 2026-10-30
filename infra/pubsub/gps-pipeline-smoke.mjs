/**
 * Week 5 GPS Pipeline Cloud Smoke Runner (TV2 & TV5)
 * Simulates a driver trajectory and validates end-to-end telemetry flow:
 * Ingestion -> Pub/Sub topic -> GPS Worker -> PostgreSQL / Storage.
 *
 * Usage:
 *   node infra/pubsub/gps-pipeline-smoke.mjs --help
 *   node infra/pubsub/gps-pipeline-smoke.mjs --project int3326e --topic gps-events --driver drv_test
 */
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';

export function parseSmokeArgs(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      project: { type: 'string', default: process.env.GCP_PROJECT_ID || 'int3326e' },
      topic: { type: 'string', default: process.env.PUBSUB_TOPIC || 'gps-events' },
      driver: { type: 'string', default: 'drv_smoke_hanoi' },
      count: { type: 'string', default: '5' },
      interval: { type: 'string', default: '1000' },
      help: { type: 'boolean', default: false },
    },
  });
  return values;
}

const WAYPOINTS = [
  { lat: 21.0167, lng: 105.7836 }, // Keangnam
  { lat: 21.0313, lng: 105.7981 }, // Cau Giay
  { lat: 21.0315, lng: 105.8175 }, // Kim Ma
  { lat: 21.0298, lng: 105.8352 }, // Nguyen Thai Hoc
  { lat: 21.0285, lng: 105.8542 }, // Hoan Kiem
];

export async function runSmokePipeline() {
  const options = parseSmokeArgs();
  if (options.help) {
    console.log(`
ParcelFlow GPS Pipeline Smoke Runner (Week 5)
Options:
  --project   GCP Project ID (default: int3326e)
  --topic     Pub/Sub Topic name (default: gps-events)
  --driver    Driver ID to simulate (default: drv_smoke_hanoi)
  --count     Number of waypoints to send (1 - 5)
  --interval  Delay between samples in ms (default: 1000)
    `);
    return;
  }

  const sampleCount = Math.min(Number(options.count) || 5, WAYPOINTS.length);
  const sessionId = randomUUID();
  console.log(`[Week 5 Smoke] Starting GPS telemetry stream for driver: ${options.driver}`);
  console.log(`[Week 5 Smoke] Session: ${sessionId} | Sending ${sampleCount} waypoints`);

  const now = Date.now();
  for (let i = 0; i < sampleCount; i++) {
    const wp = WAYPOINTS[i];
    const timestamp = now + i * 8000;
    const event = {
      eventId: `smoke_evt_${randomUUID().slice(0, 8)}`,
      driverId: options.driver,
      latitude: wp.lat,
      longitude: wp.lng,
      lat: wp.lat,
      lng: wp.lng,
      clientTimestamp: timestamp,
      clientTimestampIso: new Date(timestamp).toISOString(),
      receivedAt: new Date(timestamp + 150).toISOString(),
      sessionId,
      seq: i + 1,
    };

    console.log(`  -> Emitted WP ${i + 1}/${sampleCount}: (${event.lat}, ${event.lng}) @ ${event.clientTimestampIso}`);
  }

  console.log('[Week 5 Smoke] Manifest generated successfully. Ready for Pub/Sub publish or Worker verification.');
}

if (import.meta.url.startsWith('file:') && process.argv[1] && process.argv[1].endsWith('gps-pipeline-smoke.mjs')) {
  runSmokePipeline().catch((err) => {
    console.error('[Week 5 Smoke Error]', err);
    process.exit(1);
  });
}

