import { Body, Controller, Header, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import { ApiProblem } from '../../common/api-problem';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { placeInput, reverseInput, searchInput } from './dto/geocoding.dto';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
export class GeocodingController {
  constructor(@Inject(GeocodingService) private readonly geocoding: GeocodingService) {}

  private actor(request: AuthenticatedRequest, query: Record<string, unknown>): string {
    if (Object.keys(query).length) throw new ApiProblem(400, 'VALIDATION_ERROR', 'Query fields are not supported');
    if (!request.user) throw new ApiProblem(401, 'UNAUTHENTICATED', 'Authentication required');
    return request.user.uid;
  }

  @Post('search')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  search(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>, @Body() body: unknown) {
    const uid = this.actor(request, query);
    return this.geocoding.search(uid, searchInput(body));
  }

  @Post('reverse')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async reverse(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>, @Body() body: unknown) {
    const uid = this.actor(request, query);
    return { result: await this.geocoding.reverse(uid, reverseInput(body)) };
  }

  @Post('place')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  place(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>, @Body() body: unknown) {
    const uid = this.actor(request, query);
    return this.geocoding.place(uid, placeInput(body));
  }
}
