import { HttpException } from '@nestjs/common';

export class ApiProblem extends HttpException {
  constructor(status: number, code: string, title: string) {
    super({ code, title }, status);
  }
}
