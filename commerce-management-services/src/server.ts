import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createCommerceRoutes } from './routes/commerce.routes';
import { registerErrorHandlers } from './middleware/errorHandlers';
import { DiscoveryRegistration } from './service/discoveryRegistration';
import { AppDataSource } from './config/database';
import { repairCartVariationSchema } from './config/repairCartVariationSchema';
import { ensureFoodSchema } from './config/ensureFoodSchema';
import { ensurePropertySchema } from './config/ensurePropertySchema';
import { ensureSupportSchema } from './config/ensureSupportSchema';
import { createFoodProtectedRoutes, createFoodPublicRoutes } from './routes/food.routes';
import { createFoodPhase2Routes } from './routes/foodPhase2.routes';
import { createProductLifecyclePublicRoutes } from './routes/productLifecycle.routes';
import { jwtAuth } from './middleware/authMiddleware';

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.SERVER_PORT || '8086', 10);
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
const SERVICE_HOST = process.env.SERVICE_HOST || 'localhost';

app.use(cors());
app.use(express.json({ verify: (req, _res, buffer) => { (req as any).rawBody = buffer.toString('utf8'); } }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/commerce/food', createFoodPublicRoutes());
app.use('/api/v1/commerce', createProductLifecyclePublicRoutes());
app.use('/api/v1/commerce/food', jwtAuth, createFoodProtectedRoutes());
app.use('/api/v1/commerce/food', jwtAuth, createFoodPhase2Routes());
app.use('/api/v1/commerce', createCommerceRoutes());

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'P4U Commerce Service',
    basePath: '/api/v1/commerce',
    publicHealth: '/api/v1/commerce/public/health',
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
    console.log('Commerce DB connected');
    await repairCartVariationSchema();
    await ensureFoodSchema();
    await ensurePropertySchema();
    await ensureSupportSchema();

    app.listen(PORT, async () => {
      console.log(`Commerce Service http://localhost:${PORT}`);
      try {
        await discovery.register({
          serviceName: 'commerce-management-service',
          host: SERVICE_HOST,
          port: PORT,
          healthCheckUrl: `http://${SERVICE_HOST}:${PORT}/api/v1/commerce/public/health`,
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
