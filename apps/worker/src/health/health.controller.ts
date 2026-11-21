import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  // Cloud Run chặn /healthz ở tầng Google, nên mở thêm /health.
  @Get(['healthz', 'health'])
  check() {
    return { status: 'ok' };
  }
}

