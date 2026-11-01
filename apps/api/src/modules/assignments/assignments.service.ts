import { Inject, Injectable } from '@nestjs/common';
import { ApiProblem } from '../../common/api-problem';
import { UserRole } from '../auth/enums/user-role.enum';
import { invalidField } from '../shipments/dto/create-shipment.dto';
import { parseShipmentId } from '../shipments/dto/shipment-list-query';
import type { BusinessUser } from '../users/entities/user.entity';
import { AssignmentsRepository } from './assignments.repository';
import { parseAssignDriver } from './dto/assign-driver.dto';

@Injectable()
export class AssignmentsService {
  constructor(@Inject(AssignmentsRepository) private readonly assignments: AssignmentsRepository) {}

  assign(actor: BusinessUser, id: string, body: unknown, query: Record<string, unknown>) {
    if (actor.role !== UserRole.ADMIN) throw new ApiProblem(403, 'FORBIDDEN_RESOURCE', 'Access denied');
    if (Object.keys(query).length) invalidField('query', 'Query fields are not supported');
    return this.assignments.assign(actor, parseShipmentId(id), parseAssignDriver(body));
  }
}
