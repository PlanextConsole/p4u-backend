import { Response } from 'express';

/**
 * Standard API response envelope used across all P4U services.
 *
 * Success: { success: true,  data: T,    meta?: {...} }
 * Error:   { success: false, error: { code, message, details? } }
 */

export interface ApiMeta {
  total?: number;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

export interface ApiSuccessBody<T = unknown> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiBody<T = unknown> = ApiSuccessBody<T> | ApiErrorBody;

/* ── helper functions ──────────────────────────────────────────── */

export function sendSuccess<T>(res: Response, data: T, status = 200, meta?: ApiMeta) {
  const body: ApiSuccessBody<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T, meta?: ApiMeta) {
  return sendSuccess(res, data, 201, meta);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = { success: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}

/* ── shorthand error helpers ───────────────────────────────────── */

export function sendBadRequest(res: Response, message: string, details?: unknown) {
  return sendError(res, 400, 'BAD_REQUEST', message, details);
}

export function sendUnauthorized(res: Response, message = 'Unauthorized') {
  return sendError(res, 401, 'UNAUTHORIZED', message);
}

export function sendForbidden(res: Response, message = 'Forbidden') {
  return sendError(res, 403, 'FORBIDDEN', message);
}

export function sendNotFound(res: Response, message = 'Not found') {
  return sendError(res, 404, 'NOT_FOUND', message);
}

export function sendConflict(res: Response, message: string) {
  return sendError(res, 409, 'CONFLICT', message);
}

export function sendServerError(res: Response, message = 'Internal server error') {
  return sendError(res, 500, 'INTERNAL_ERROR', message);
}
