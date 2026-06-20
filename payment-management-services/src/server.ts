import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createPaymentRoutes } from './routes/payment.routes';
import { createWebhookRoutes } from './routes/webhook.routes';
import { registerErrorHandlers } from './middleware/errorHandlers';
import { DiscoveryRegistration } from './service/discoveryRegistration';
import { AppDataSource } from './config/database';

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.SERVER_PORT || '8087', 10);
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
const SERVICE_HOST = process.env.SERVICE_HOST || 'localhost';

app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use(
  '/api/v1/payments/webhooks/razorpay',
  express.raw({
    type: 'application/json',
    verify: (req, _res, buf) => {
      (req as any).rawBody = Buffer.from(buf);
    },
  })
);
app.use(express.json());

app.use('/api/v1/payments', createPaymentRoutes());
app.use('/api/v1/payments', createWebhookRoutes());

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'P4U Payment Service',
    basePath: '/api/v1/payments',
    publicHealth: '/api/v1/payments/public/health',
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
          serviceName: 'payment-management-service',
          host: SERVICE_HOST,
          port: PORT,
          healthCheckUrl: `http://${SERVICE_HOST}:${PORT}/api/v1/payments/public/health`,
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
