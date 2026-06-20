import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createSocioRoutes } from './routes/socio.routes';
import { createSocioUploadRoutes, createSocioMediaPublicRoutes } from './routes/upload.routes';
import { registerErrorHandlers } from './middleware/errorHandlers';
import { DiscoveryRegistration } from './service/discoveryRegistration';
import { AppDataSource } from './config/database';

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.SERVER_PORT || '8090', 10);
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
const SERVICE_HOST = process.env.SERVICE_HOST || 'localhost';

app.use(cors());

// Public media reads — bytes streamed straight from `social_media`. Mounted before
// the JWT-gated routers so <img> tags can fetch without a token.
app.use('/socio-uploads', createSocioMediaPublicRoutes());

// Upload routes MUST be registered BEFORE express.json() so multer can parse multipart/form-data.
app.use('/api/v1/social', createSocioUploadRoutes());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/social', createSocioRoutes());

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'P4U Socio Management Service',
    basePath: '/api/v1/social',
    publicHealth: '/api/v1/social/public/health',
  });
});

registerErrorHandlers(app);
const discovery = new DiscoveryRegistration(DISCOVERY_URL);

async function shutdown() {
  await discovery.deregister();
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function startServer() {
  try {
    await AppDataSource.initialize();
    app.listen(PORT, async () => {
      try {
        await discovery.register({
          serviceName: 'socio-management-service',
          host: SERVICE_HOST,
          port: PORT,
          healthCheckUrl: `http://${SERVICE_HOST}:${PORT}/api/v1/social/public/health`,
          metadata: { protocol: 'http', version: '1.0.0' },
        });
      } catch {
        // ignore
      }
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

startServer();
