import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';
import { adminUploadRoot, ensureAdminUploadDir } from './config/uploadPaths';
import { bootstrapAllSharedTables } from './config/bootstrapSchema';
import {
  repairCatalogVendorsSchema,
  repairCustomerProfilesSchema,
  repairBulkUploadJobsSchema,
  repairMediaLibrarySchema,
  repairOccupationAdminCreatePlatformVariableSeed,
  repairPushNotificationSendsSchema,
  repairVendorPlansSchema,
  repairProductAttributesSchema,
  repairPricingEngineSchema,
  repairVendorCatalogModerationSchema,
  repairVendorBookingAvailabilitySchema,
  repairProductVariationsSchema,
  seedPlatformVariableDefaults,
  seedDefaultVendorPlans,
} from './config/schemaRepair';
import { createAdminRoutes } from './modules/admin-core/admin-core.routes';
import { createUploadRoutes } from './modules/upload/upload.routes';
import { registerErrorHandlers } from './middleware/errorHandlers';
import { DiscoveryRegistration } from './service/discoveryRegistration';

const app: Express = express();
const PORT = parseInt(process.env.SERVER_PORT || '8082', 10);
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';

ensureAdminUploadDir();

app.use(cors());

// Upload routes MUST be registered BEFORE express.json() to keep the multipart stream intact
app.use('/api/admin', createUploadRoutes());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(adminUploadRoot()));

async function startServer() {
  try {
    const isPostgres = (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres';
    if (!isPostgres) {
      // 1. Create the database (if missing) and ALL shared tables from the canonical schema dump.
      await bootstrapAllSharedTables();

      // 2. Column-level repairs for tables that already exist but lack newer columns.
      await repairCustomerProfilesSchema();
      await repairCatalogVendorsSchema();
      await repairVendorPlansSchema();
      await repairPushNotificationSendsSchema();
      await repairMediaLibrarySchema();
      await repairBulkUploadJobsSchema();
      await repairProductAttributesSchema();
      await repairPricingEngineSchema();
      await repairVendorCatalogModerationSchema();
      await repairVendorBookingAvailabilitySchema();
      await repairProductVariationsSchema();

      // 3. Seed defaults — only inserts when target rows/tables are empty.
      await repairOccupationAdminCreatePlatformVariableSeed();
      await seedPlatformVariableDefaults();
      await seedDefaultVendorPlans();
    } else {
      console.log('[admin-service] MySQL bootstrap/repair skipped on postgres');
    }

    await AppDataSource.initialize();
    console.log('Admin DB connected');

    app.use('/api/admin', createAdminRoutes());

    app.get('/', (req: Request, res: Response) => {
      res.json({ message: 'Admin Management Service API', basePath: '/api/admin' });
    });

    registerErrorHandlers(app);

    app.listen(PORT, async () => {
      console.log(`Admin Management Service http://localhost:${PORT}`);

      const discovery = new DiscoveryRegistration(DISCOVERY_URL);
      try {
        await discovery.register({
          serviceName: 'admin-management-service',
          host: process.env.SERVICE_HOST || 'localhost',
          port: PORT,
          healthCheckUrl: `http://${process.env.SERVICE_HOST || 'localhost'}:${PORT}/api/admin/public/health`,
          metadata: { protocol: 'http', version: '1.0.0' },
        });
        (global as any).discoveryRegistration = discovery;
      } catch {
        console.log('Discovery not available, continuing');
      }
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

async function shutdown() {
  const discovery = (global as any).discoveryRegistration as DiscoveryRegistration | undefined;
  if (discovery) {
    await discovery.deregister();
  }
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();
