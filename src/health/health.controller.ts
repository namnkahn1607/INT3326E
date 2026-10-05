import { Controller, Get } from '@nestjs/common';

@Controller('healthz')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'parcelflow-gps-worker',
      timestamp: new Date().toISOString(),
    };
  }
}