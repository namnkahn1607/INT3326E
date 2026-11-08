import { BadRequestException } from '@nestjs/common';

export type DirectoryScope = 'drivers' | 'customers';

export interface DirectoryCursor {
  createdAt: string;
  id: string;
}

export interface AdminListQuery {
  limit: number;
  after: DirectoryCursor | null;
}

export const DIRECTORY_USER_ID = /^usr_[0-9A-HJKMNP-TV-Z]{26}$/;
const CURSOR_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export function encodeDirectoryCursor(scope: DirectoryScope, cursor: DirectoryCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, scope, ...cursor })).toString('base64url');
}

export function parseAdminListQuery(query: Record<string, unknown>, scope: DirectoryScope): AdminListQuery {
  if (Object.keys(query).some((key) => key !== 'limit' && key !== 'cursor')) {
    throw new BadRequestException();
  }
  let limit = 20;
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit)) {
      throw new BadRequestException();
    }
    limit = Number(query.limit);
    if (limit > 100) throw new BadRequestException();
  }
  if (query.cursor === undefined) return { limit, after: null };
  const token = query.cursor;
  if (typeof token !== 'string' || token.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new BadRequestException();
  }
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.toString('base64url') !== token) throw new Error();
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const cursor = value as Record<string, unknown>;
    if (Object.keys(cursor).sort().join(',') !== 'createdAt,id,scope,v' ||
        cursor.v !== 1 || cursor.scope !== scope ||
        typeof cursor.id !== 'string' || !DIRECTORY_USER_ID.test(cursor.id) ||
        typeof cursor.createdAt !== 'string' || !CURSOR_TIME.test(cursor.createdAt) ||
        cursor.createdAt.startsWith('0000')) {
      throw new Error();
    }
    const milliseconds = `${cursor.createdAt.slice(0, 23)}Z`;
    if (new Date(milliseconds).toISOString() !== milliseconds) throw new Error();
    return { limit, after: { id: cursor.id, createdAt: cursor.createdAt } };
  } catch {
    throw new BadRequestException();
  }
}
