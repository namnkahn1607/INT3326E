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
      // Khóa đơn trước khi kiểm tra. Request đang chờ sẽ đọc trạng thái và tài xế sau lần commit trước.
      const locked = await client.query<ShipmentRow>(`
        SELECT ${SHIPMENT_PROJECTION} FROM shipments s WHERE s.id = $1 FOR UPDATE OF s`, [id]);
      const current = locked.rows[0];
      if (!current) throw new ApiProblem(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (current.status !== 'CREATED' && current.status !== 'ASSIGNED') {
        throw new ApiProblem(409, 'INVALID_STATE_TRANSITION', 'Đơn đã lấy hàng hoặc kết thúc, không thể phân công lại');
      }
      // Khóa cả tài khoản được chọn để role không đổi giữa lúc kiểm tra và commit.
      const driver = await client.query<{ role: string }>('SELECT role FROM users WHERE id = $1 FOR SHARE', [driverId]);
      if (!driver.rows[0]) throw new ApiProblem(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tài xế');
      if (driver.rows[0].role !== UserRole.DRIVER) invalidField('driverId', 'Tài khoản được chọn phải có quyền DRIVER');
      if (current.driverId === driverId) {
        const response = shipmentResponse(current);
        // Gán lại đúng tài xế hiện tại: giữ nguyên thời gian, lịch sử và thông báo.
        await client.query('COMMIT');
        return response;
      }

      // Lấy giờ máy chủ sau khi có khóa để không tính cả thời gian request phải chờ.
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
      // Chỉ trả thành công khi cả ba bước ghi đã commit. Nếu mất phản hồi, không tự gán lại.
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
