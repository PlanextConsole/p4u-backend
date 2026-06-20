import { Express, Request, Response, NextFunction } from 'express';

export function registerErrorHandlers(app: Express): void {
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Client closed the socket before the JSON body finished uploading (raw-body / express.json).
    // Nothing useful to return; the peer is already gone.
    if (err?.type === 'request.aborted' || err?.code === 'ECONNABORTED') {
      return;
    }
    next(err);
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err?.name === 'UnauthorizedError') {
      return res.status(401).json({ message: 'Unauthorized: Invalid or missing token' });
    }
    next(err);
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  });
}
