import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createVendorRoutes } from './routes/vendor.routes';
import { registerErrorHandlers } from './middleware/errorHandlers';
import { DiscoveryRegistration } from './service/discoveryRegistration';
import { AppDataSource, isPostgresDbType } from './config/database';
import { ensureVendorUploadDir, vendorUploadRoot } from './config/vendorImageUpload';
import { repairVendorCatalogModerationSchema } from './config/repairVendorCatalogModeration';
import { repairVendorBookingAvailabilitySchema } from './config/repairVendorBookingAvailability';
import { repairVendorMediaSchema } from './config/repairVendorMediaSchema';
import { repairVendorDropshippingSchema } from './config/repairVendorDropshippingSchema';

dotenv.config();

ensureVendorUploadDir();

const app: Express = express();
const PORT = parseInt(process.env.SERVER_PORT || '8089', 10);
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
const SERVICE_HOST = process.env.SERVICE_HOST || 'localhost';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(vendorUploadRoot(), { maxAge: '7d' }));

app.use('/api/v1/vendor', createVendorRoutes());

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'P4U Vendor Portal Service',
    basePath: '/api/v1/vendor',
    publicHealth: '/api/v1/vendor/public/health',
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
    const isPostgres = isPostgresDbType();
    if (!isPostgres) {
      await repairVendorCatalogModerationSchema();
      await repairVendorBookingAvailabilitySchema();
      await repairVendorMediaSchema();
      await repairVendorDropshippingSchema();
    } else {
      console.log('[vendor-service] MySQL schema repair skipped on postgres');
    }
    await AppDataSource.initialize();
    console.log('Vendor portal DB connected');

    app.listen(PORT, async () => {
      console.log(`Vendor Portal Service http://localhost:${PORT}`);
      try {
        await discovery.register({
          serviceName: 'vendor-management-service',
          host: SERVICE_HOST,
          port: PORT,
          healthCheckUrl: `http://${SERVICE_HOST}:${PORT}/api/v1/vendor/public/health`,
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
