import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ApiProblem } from '../../common/api-problem';
import { UserRole } from '../auth/enums/user-role.enum';
import type { BusinessUser } from '../users/entities/user.entity';
import { invalidField, type CreateShipmentDto } from './dto/create-shipment.dto';
import type { ShipmentResponseDto } from './dto/shipment-response.dto';
import { shipmentIdentifiers } from './shipment-identifiers';
import { ShipmentsRepository } from './shipments.repository';

export const SHIPMENT_IDEMPOTENCY_TTL = Symbol('SHIPMENT_IDEMPOTENCY_TTL');
export const shipmentIdempotencyTtlProvider = {
  provide: SHIPMENT_IDEMPOTENCY_TTL,
  useFactory: (): number => {
    const value = process.env.SHIPMENT_IDEMPOTENCY_TTL_SECONDS ?? '86400';
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 31536000) {
      throw new Error('SHIPMENT_IDEMPOTENCY_TTL_SECONDS must be an integer between 1 and 31536000');
    }
    return Number(value);
  },
};

@Injectable()
export class ShipmentsService {
  constructor(
    @Inject(ShipmentsRepository) private readonly shipments: ShipmentsRepository,
    @Inject(SHIPMENT_IDEMPOTENCY_TTL) private readonly ttl: number,
  ) {}

  async create(actor: BusinessUser, payload: CreateShipmentDto, key: string): Promise<ShipmentResponseDto> {
    if (actor.role !== UserRole.CUSTOMER) throw new ApiProblem(403, 'FORBIDDEN_RESOURCE', 'Access denied');
    if (!/^usr_[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(actor.id)) {
      throw new ApiProblem(409, 'USER_NOT_PROVISIONED', 'Business user ID does not match the contract');
    }
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.shipments.create(actor.id, key, hash, this.ttl, (now) => {
      // Replay is decided under the DB key lock before this dynamic validation runs.
      if (payload.expectedDeliveryAt !== null && Date.parse(payload.expectedDeliveryAt) <= now.getTime()) {
        invalidField('expectedDeliveryAt', 'Must be after the shipment creation time');
      }
      return { ...payload, ...shipmentIdentifiers(now), customerId: actor.id, driverId: null, status: 'CREATED',
        isLate: payload.expectedDeliveryAt === null ? null : false,
        failureReason: null, failedByRole: null, failedByUserId: null, proofOfDeliveryNotes: null,
        createdAt: now.toISOString(), updatedAt: now.toISOString() };
    });
  }
}
