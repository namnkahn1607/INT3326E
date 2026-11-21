import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator';

// Cloud Run chặn /healthz ở tầng Google, nên mở thêm /health.
@Controller(['healthz', 'health'])
export class HealthController {
  @Get()
  @Public()
  check(): { status: 'ok'; service: 'api' } {
    return { status: 'ok', service: 'api' };
  }
}
