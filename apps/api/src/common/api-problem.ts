import { HttpException } from '@nestjs/common';

export class ApiProblem extends HttpException {
  constructor(status: number, code: string, title: string, errors?: { field: string; message: string }[]) {
    super({ code, title, ...(errors ? { errors } : {}) }, status);
  }
}
