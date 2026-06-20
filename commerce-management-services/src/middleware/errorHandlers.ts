import { Express, Request, Response, NextFunction } from 'express';

export function registerErrorHandlers(app: Express): void {
  // Handle JWT auth errors
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      });
    }
    next(err);
  });

  // Handle all other errors
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
}
