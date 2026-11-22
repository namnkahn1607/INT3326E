import { randomUUID } from 'node:crypto';
import { HttpException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ApiProblem } from '../../common/api-problem';
import { logDependencyFailure, type DependencyStage } from '../../common/dependency-diagnostics';
import { USER_DATABASE } from '../users/user-database.provider';
import type { BusinessUser } from '../users/entities/user.entity';
import type { ShipmentResponseDto } from './dto/shipment-response.dto';
import { SHIPMENT_PROJECTION, shipmentResponse, type ShipmentRow } from './shipment-response.mapper';

interface IdempotencyRow {
  requestHash: string;
  responseStatus: number | null;
  responseBody: ShipmentResponseDto | null;
  expiresAt: Date | string;
}

@Injectable()
export class ShipmentsRepository {
  private readonly logger = new Logger(ShipmentsRepository.name);
  constructor(@Inject(USER_DATABASE) private readonly pool: Pool | null) {}

  async create(actorId: string, key: string, hash: string, ttlSeconds: number,
    makeShipment: (now: Date) => ShipmentResponseDto): Promise<ShipmentResponseDto> {
    if (!this.pool) {
      logDependencyFailure(this.logger, 'shipments.connect', { code: 'DATABASE_URL_MISSING' });
      throw new ServiceUnavailableException();
    }
    let client: PoolClient | undefined;
    let releaseError: Error | undefined;
    let stage: DependencyStage = 'shipments.connect';
    try {
      client = await this.pool.connect();
      stage = 'shipments.begin';
      await client.query('BEGIN');
      const scope = [actorId, 'CREATE_SHIPMENT', key];
      // The no-op conflict update takes the row lock even when another instance owns the first request.
      stage = 'shipments.idempotency.claim';
      const claimed = await client.query<IdempotencyRow>(`
        INSERT INTO idempotency_requests ("actorUserId", operation, key, "requestHash", "createdAt", "expiresAt")
        VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp() + $5 * interval '1 second')
        ON CONFLICT ("actorUserId", operation, key) DO UPDATE SET key = EXCLUDED.key
        RETURNING "requestHash", "responseStatus", "responseBody", "expiresAt"`, [...scope, hash, ttlSeconds]);
      stage = 'shipments.clock';
      const { rows: clocks } = await client.query<{ now: Date | string }>('SELECT clock_timestamp() AS now');
      const now = new Date(clocks[0].now);
      stage = 'shipments.idempotency.read';
      const row = claimed.rows[0];
      if (new Date(row.expiresAt).getTime() > now.getTime() && row.responseBody !== null) {
        if (row.requestHash !== hash) throw new ApiProblem(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key was used with a different payload');
        if (row.responseStatus !== 201) throw new Error('Incomplete idempotency response');
        stage = 'shipments.commit';
        await client.query('COMMIT');
        return row.responseBody;
      }
      stage = 'shipments.idempotency.refresh';
      await client.query(`UPDATE idempotency_requests SET "requestHash"=$4, "responseStatus"=NULL, "responseBody"=NULL,
        "createdAt"=$5, "expiresAt"=$5::timestamptz + $6 * interval '1 second'
        WHERE "actorUserId"=$1 AND operation=$2 AND key=$3`, [...scope, hash, now.toISOString(), ttlSeconds]);
      let shipment: ShipmentResponseDto | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        stage = 'shipments.build';
        const candidate = makeShipment(now);
        stage = 'shipments.insert';
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
      if (!shipment) {
        logDependencyFailure(this.logger, 'shipments.insert', { code: 'TRACKING_CODE_RETRY_EXHAUSTED' });
        throw new ServiceUnavailableException();
      }
      const eventId = randomUUID();
      stage = 'shipments.event.insert';
      await client.query(`INSERT INTO shipment_status_events
        (id,"shipmentId",action,"fromStatus","toStatus","actorUserId","actorRole","previousDriverId","newDriverId",reason,"occurredAt")
        VALUES ($1,$2,'CREATED',NULL,'CREATED',$3,'CUSTOMER',NULL,NULL,NULL,$4)`,
      [eventId, shipment.id, actorId, shipment.createdAt]);
      stage = 'shipments.notification.insert';
      await client.query(`INSERT INTO notifications
        (id,"customerId","shipmentId","statusEventId",kind,title,body,"createdAt")
        VALUES ($1,$2,$3,$4,'CREATED',$5,$6,$7)`, [randomUUID(), actorId, shipment.id, eventId,
        'Đã tạo đơn hàng', `Đơn ${shipment.trackingNumber} đã được tiếp nhận.`, shipment.createdAt]);
      stage = 'shipments.idempotency.complete';
      await client.query(`UPDATE idempotency_requests SET "responseStatus"=201,"responseBody"=$4::jsonb
        WHERE "actorUserId"=$1 AND operation=$2 AND key=$3`, [...scope, JSON.stringify(shipment)]);
      stage = 'shipments.commit';
      await client.query('COMMIT');
      return shipment;
    } catch (error) {
      if (!(error instanceof HttpException)) logDependencyFailure(this.logger, stage, error);
      try { await client?.query('ROLLBACK'); }
      catch (rollbackError) {
        logDependencyFailure(this.logger, 'shipments.rollback', rollbackError);
        releaseError = new Error('Transaction connection is unusable');
      }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    } finally { client?.release(releaseError); }
  }

  async pickup(driverId: string, id: string): Promise<ShipmentResponseDto> {
    return this.runLockedTransition(
      { id: driverId, role: 'DRIVER' }, id, 'PICKED_UP', 'ASSIGNED', null,
      (client, occurredAt) => client.query(`UPDATE shipments SET status='PICKED_UP', "updatedAt"=$2 WHERE id=$1`, [id, occurredAt]),
      { title: 'Tài xế đã lấy hàng', body: code => `Đơn ${code} đã được tài xế nhận và đang giao.` },
    );
  }

  async deliver(driverId: string, id: string, proofOfDeliveryNotes: string | null): Promise<ShipmentResponseDto> {
    return this.runLockedTransition(
      { id: driverId, role: 'DRIVER' }, id, 'DELIVERED', 'PICKED_UP', null,
      (client, occurredAt) => client.query(
        `UPDATE shipments SET status='DELIVERED', "proofOfDeliveryNotes"=$2, "updatedAt"=$3 WHERE id=$1`,
        [id, proofOfDeliveryNotes, occurredAt]),
      { title: 'Đơn hàng đã giao thành công', body: code => `Đơn ${code} đã được giao thành công.` },
    );
  }

  async fail(actor: BusinessUser, id: string, reason: string): Promise<ShipmentResponseDto> {
    if (actor.role !== 'DRIVER' && actor.role !== 'ADMIN') {
      throw new ApiProblem(403, 'FORBIDDEN_RESOURCE', 'Không có quyền thao tác với đơn hàng này');
    }
    const role = actor.role;
    return this.runLockedTransition(
      { id: actor.id, role }, id, 'DELIVERY_FAILED', 'PICKED_UP', reason,
      (client, occurredAt) => client.query(
        `UPDATE shipments SET status='DELIVERY_FAILED', "failureReason"=$2, "failedByUserId"=$3, "failedByRole"=$4, "updatedAt"=$5 WHERE id=$1`,
        [id, reason, actor.id, role, occurredAt]),
      { title: 'Giao hàng thất bại', body: code => `Đơn ${code} giao không thành công.` },
    );
  }

  private async runLockedTransition(
    actor: { id: string; role: 'DRIVER' | 'ADMIN' },
    id: string,
    target: 'PICKED_UP' | 'DELIVERED' | 'DELIVERY_FAILED',
    expectedFrom: 'ASSIGNED' | 'PICKED_UP',
    reason: string | null,
    applyUpdate: (client: PoolClient, occurredAt: string) => Promise<unknown>,
    notification: { title: string; body: (trackingCode: string) => string },
  ): Promise<ShipmentResponseDto> {
    if (!this.pool) throw new ServiceUnavailableException();
    let client: PoolClient | undefined;
    let releaseError: Error | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      // Khóa dòng đơn trước khi kiểm tra quyền sở hữu và trạng thái để tránh race với phân công lại hoặc chuyển kết thúc khác.
      const locked = await client.query<ShipmentRow>(
        `SELECT ${SHIPMENT_PROJECTION} FROM shipments s WHERE s.id = $1 FOR UPDATE OF s`, [id]);
      const current = locked.rows[0];
      if (!current) throw new ApiProblem(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (actor.role !== 'ADMIN' && current.driverId !== actor.id) {
        throw new ApiProblem(403, 'FORBIDDEN_RESOURCE', 'Không có quyền thao tác với đơn hàng này');
      }
      if (current.status === target) {
        // Đọc lại bằng snapshot mới sau khi có khóa FOR UPDATE để subquery terminalAt thấy event vừa commit.
        const fresh = await client.query<ShipmentRow>(
          `SELECT ${SHIPMENT_PROJECTION} FROM shipments s WHERE s.id = $1`, [id]);
        const response = shipmentResponse(fresh.rows[0]);
        // Gọi lặp cùng bước bởi actor hợp lệ là no-op, giữ nguyên lý do/ghi chú và thời điểm đầu tiên.
        await client.query('COMMIT');
        return response;
      }
      if (current.status !== expectedFrom) {
        throw new ApiProblem(409, 'INVALID_STATE_TRANSITION', 'Trạng thái đơn hiện tại không cho phép thực hiện thao tác này');
      }

      const clock = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      const occurredAt = new Date(clock.rows[0].now).toISOString();
      await applyUpdate(client, occurredAt);
      const eventId = randomUUID();
      await client.query(`INSERT INTO shipment_status_events
        (id,"shipmentId",action,"fromStatus","toStatus","actorUserId","actorRole","previousDriverId","newDriverId",reason,"occurredAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10)`,
      [eventId, id, target, expectedFrom, target, actor.id, actor.role, current.driverId, reason, occurredAt]);
      await client.query(`INSERT INTO notifications
        (id,"customerId","shipmentId","statusEventId",kind,title,body,"createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
        randomUUID(), current.senderId, id, eventId, target,
        notification.title, notification.body(current.trackingCode), occurredAt,
      ]);
      const updated = await client.query<ShipmentRow>(`SELECT ${SHIPMENT_PROJECTION} FROM shipments s WHERE s.id=$1`, [id]);
      const response = shipmentResponse(updated.rows[0]);
      await client.query('COMMIT');
      return response;
    } catch (error) {
      try { await client?.query('ROLLBACK'); }
      catch { releaseError = new Error('Kết nối không còn dùng được sau khi hoàn tác giao dịch'); }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    } finally { client?.release(releaseError); }
  }
}
