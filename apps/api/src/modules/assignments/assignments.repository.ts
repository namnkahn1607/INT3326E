import { randomUUID } from 'node:crypto';
import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ApiProblem } from '../../common/api-problem';
import { UserRole } from '../auth/enums/user-role.enum';
import { invalidField } from '../shipments/dto/create-shipment.dto';
import { SHIPMENT_PROJECTION, shipmentResponse, type ShipmentRow } from '../shipments/shipment-response.mapper';
import type { BusinessUser } from '../users/entities/user.entity';
import { USER_DATABASE } from '../users/user-database.provider';

@Injectable()
export class AssignmentsRepository {
  constructor(@Inject(USER_DATABASE) private readonly pool: Pool | null) {}

  async assign(actor: BusinessUser, id: string, driverId: string) {
    if (!this.pool) throw new ServiceUnavailableException();
    let client: PoolClient | undefined;
    let releaseError: Error | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      // Every assignment locks the shipment first. Waiting requests then see the committed driver/state.
      const locked = await client.query<ShipmentRow>(`
        SELECT ${SHIPMENT_PROJECTION} FROM shipments s WHERE s.id = $1 FOR UPDATE OF s`, [id]);
      const current = locked.rows[0];
      if (!current) throw new ApiProblem(404, 'RESOURCE_NOT_FOUND', 'Shipment not found');
      if (current.status !== 'CREATED' && current.status !== 'ASSIGNED') {
        throw new ApiProblem(409, 'INVALID_STATE_TRANSITION', 'Shipment can no longer be assigned');
      }
      // Lock the target role too, so it cannot change between validation and commit.
      const driver = await client.query<{ role: string }>('SELECT role FROM users WHERE id = $1 FOR SHARE', [driverId]);
      if (!driver.rows[0]) throw new ApiProblem(404, 'RESOURCE_NOT_FOUND', 'Driver not found');
      if (driver.rows[0].role !== UserRole.DRIVER) invalidField('driverId', 'Selected user must be a DRIVER');
      if (current.driverId === driverId) {
        const response = shipmentResponse(current);
        // No-op preserves the original mutation time, event and notification.
        await client.query('COMMIT');
        return response;
      }

      // Read server time after obtaining the lock, rather than at transaction start.
      const clock = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      const occurredAt = new Date(clock.rows[0].now).toISOString();
      const action = current.status === 'CREATED' ? 'ASSIGNED' : 'REASSIGNED';
      await client.query(`UPDATE shipments SET "driverId"=$2, status='ASSIGNED', "updatedAt"=$3 WHERE id=$1`,
        [id, driverId, occurredAt]);
      const eventId = randomUUID();
      await client.query(`INSERT INTO shipment_status_events
        (id,"shipmentId",action,"fromStatus","toStatus","actorUserId","actorRole","previousDriverId","newDriverId",reason,"occurredAt")
        VALUES ($1,$2,$3,$4,'ASSIGNED',$5,'ADMIN',$6,$7,NULL,$8)`,
      [eventId, id, action, current.status, actor.id, current.driverId, driverId, occurredAt]);
      await client.query(`INSERT INTO notifications
        (id,"customerId","shipmentId","statusEventId",kind,title,body,"createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(), current.senderId, id, eventId, action,
        action === 'ASSIGNED' ? 'Đã phân công tài xế' : 'Đã thay đổi tài xế',
        `Đơn ${current.trackingCode} đã được ${action === 'ASSIGNED' ? 'phân công' : 'đổi'} tài xế.`, occurredAt]);
      const updated = await client.query<ShipmentRow>(`SELECT ${SHIPMENT_PROJECTION} FROM shipments s WHERE s.id=$1`, [id]);
      const response = shipmentResponse(updated.rows[0]);
      // Respond only after all three writes commit. An uncertain commit must not trigger an automatic retry.
      await client.query('COMMIT');
      return response;
    } catch (error) {
      try { await client?.query('ROLLBACK'); }
      catch { releaseError = new Error('Transaction connection is unusable'); }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    } finally { client?.release(releaseError); }
  }
}
