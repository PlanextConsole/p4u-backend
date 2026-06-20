import { Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { sendBadRequest } from './responseEnvelope';

/**
 * Express middleware that validates req.body against a class-validator DTO.
 *
 * Usage:
 *   router.post('/items', validateBody(CreateItemDto), handler);
 */
export function validateBody(DtoClass: new () => object) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(DtoClass, req.body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const details = flattenErrors(errors);
      return sendBadRequest(res, 'Validation failed', details);
    }

    // Replace body with the validated+transformed DTO
    req.body = dto;
    next();
  };
}

/**
 * Same as validateBody but for PATCH endpoints where all fields are optional.
 */
export function validateBodyPartial(DtoClass: new () => object) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(DtoClass, req.body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    });

    if (errors.length > 0) {
      const details = flattenErrors(errors);
      return sendBadRequest(res, 'Validation failed', details);
    }

    req.body = dto;
    next();
  };
}

function flattenErrors(errors: ValidationError[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const err of errors) {
    const messages = err.constraints ? Object.values(err.constraints) : [];
    if (messages.length) {
      result[err.property] = messages;
    }
    if (err.children?.length) {
      const nested = flattenErrors(err.children);
      for (const [key, msgs] of Object.entries(nested)) {
        result[`${err.property}.${key}`] = msgs;
      }
    }
  }
  return result;
}
