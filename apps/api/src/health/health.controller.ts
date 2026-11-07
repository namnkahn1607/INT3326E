import { Controller, Get } from '@nestjs/common';

@Controller('healthz')
export class HealthController {
  @Get()
  check(): { status: 'ok'; service: 'api' } {
    return { status: 'ok', service: 'api' };
  }
}
