import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createContentRoutes } from './routes/content.routes';
import { createContentAdminRoutes } from './routes/contentAdmin.routes';
import { registerErrorHandlers } from './middleware/errorHandlers';
import { DiscoveryRegistration } from './service/discoveryRegistration';
import { AppDataSource } from './config/database';

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.SERVER_PORT || '8084', 10);
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
const SERVICE_HOST = process.env.SERVICE_HOST || 'localhost';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/content', createContentRoutes());
app.use('/api/v1/content/admin', createContentAdminRoutes());

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'P4U Content Service',
    basePath: '/api/v1/content',
    publicHealth: '/api/v1/content/public/health',
  });
});

registerErrorHandlers(app);

const discovery = new DiscoveryRegistration(DISCOVERY_URL);

async function shutdown() {
  await discovery.deregister();
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('Content DB connected');

    app.listen(PORT, async () => {
      console.log(`Content Service http://localhost:${PORT}`);

      try {
        await discovery.register({
          serviceName: 'content-management-service',
          host: SERVICE_HOST,
          port: PORT,
          healthCheckUrl: `http://${SERVICE_HOST}:${PORT}/api/v1/content/public/health`,
          metadata: { protocol: 'http', version: '1.0.0' },
        });
      } catch {
        console.log('Discovery not available, continuing');
      }
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

startServer();
