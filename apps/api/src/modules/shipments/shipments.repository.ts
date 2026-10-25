import { randomUUID } from 'node:crypto';
import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ApiProblem } from '../../common/api-problem';
import { USER_DATABASE } from '../users/user-database.provider';
import type { ShipmentResponseDto } from './dto/shipment-response.dto';

interface IdempotencyRow {
  requestHash: string;
  responseStatus: number | null;
  responseBody: ShipmentResponseDto | null;
  expiresAt: Date | string;
}

@Injectable()
export class ShipmentsRepository {
  constructor(@Inject(USER_DATABASE) private readonly pool: Pool | null) {}

  async create(actorId: string, key: string, hash: string, ttlSeconds: number,
    makeShipment: (now: Date) => ShipmentResponseDto): Promise<ShipmentResponseDto> {
    if (!this.pool) throw new ServiceUnavailableException();
    let client: PoolClient | undefined;
    let releaseError: Error | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const scope = [actorId, 'CREATE_SHIPMENT', key];
      // The no-op conflict update takes the row lock even when another instance owns the first request.
      const claimed = await client.query<IdempotencyRow>(`
        INSERT INTO idempotency_requests ("actorUserId", operation, key, "requestHash", "createdAt", "expiresAt")
        VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp() + $5 * interval '1 second')
        ON CONFLICT ("actorUserId", operation, key) DO UPDATE SET key = EXCLUDED.key
        RETURNING "requestHash", "responseStatus", "responseBody", "expiresAt"`, [...scope, hash, ttlSeconds]);
      const { rows: clocks } = await client.query<{ now: Date | string }>('SELECT clock_timestamp() AS now');
      const now = new Date(clocks[0].now);
      const row = claimed.rows[0];
      if (new Date(row.expiresAt).getTime() > now.getTime() && row.responseBody !== null) {
        if (row.requestHash !== hash) throw new ApiProblem(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key was used with a different payload');
        if (row.responseStatus !== 201) throw new Error('Incomplete idempotency response');
        await client.query('COMMIT');
        return row.responseBody;
      }
      await client.query(`UPDATE idempotency_requests SET "requestHash"=$4, "responseStatus"=NULL, "responseBody"=NULL,
        "createdAt"=$5, "expiresAt"=$5::timestamptz + $6 * interval '1 second'
        WHERE "actorUserId"=$1 AND operation=$2 AND key=$3`, [...scope, hash, now.toISOString(), ttlSeconds]);
      let shipment: ShipmentResponseDto | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = makeShipment(now);
        const inserted = await client.query(`INSERT INTO shipments
          (id,"trackingCode","senderId","driverId",status,"pickupAddress","pickupLat","pickupLng",
          "deliveryAddress","deliveryLat","deliveryLng","recipientName","recipientPhone",notes,
          "packageDescription","packageWeightKg","expectedDeliveryAt","createdAt","updatedAt")
          VALUES ($1,$2,$3,NULL,'CREATED',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
          ON CONFLICT ("trackingCode") DO NOTHING RETURNING id`, [
          candidate.id, candidate.trackingNumber, actorId, candidate.pickupAddress, candidate.pickupLocation.lat,
          candidate.pickupLocation.lng, candidate.dropoffAddress, candidate.dropoffLocation.lat, candidate.dropoffLocation.lng,
          candidate.recipientName, candidate.recipientPhone, candidate.notes, candidate.packageDescription,
          candidate.packageWeightKg, candidate.expectedDeliveryAt, candidate.createdAt,
        ]);
        if (inserted.rows.length === 1) { shipment = candidate; break; }
      }
      if (!shipment) throw new ServiceUnavailableException();
      const eventId = randomUUID();
      await client.query(`INSERT INTO shipment_status_events
        (id,"shipmentId",action,"fromStatus","toStatus","actorUserId","actorRole","previousDriverId","newDriverId",reason,"occurredAt")
        VALUES ($1,$2,'CREATED',NULL,'CREATED',$3,'CUSTOMER',NULL,NULL,NULL,$4)`,
      [eventId, shipment.id, actorId, shipment.createdAt]);
      await client.query(`INSERT INTO notifications
        (id,"customerId","shipmentId","statusEventId",kind,title,body,"createdAt")
        VALUES ($1,$2,$3,$4,'CREATED',$5,$6,$7)`, [randomUUID(), actorId, shipment.id, eventId,
        'Đã tạo đơn hàng', `Đơn ${shipment.trackingNumber} đã được tiếp nhận.`, shipment.createdAt]);
      await client.query(`UPDATE idempotency_requests SET "responseStatus"=201,"responseBody"=$4::jsonb
        WHERE "actorUserId"=$1 AND operation=$2 AND key=$3`, [...scope, JSON.stringify(shipment)]);
      await client.query('COMMIT');
      return shipment;
    } catch (error) {
      try { await client?.query('ROLLBACK'); }
      catch { releaseError = new Error('Transaction connection is unusable'); }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    } finally { client?.release(releaseError); }
  }
}
