import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AppDataSource } from './config/database';
import { repairAuthSchema } from './config/schemaRepair';
import { getKeycloakAdminClient } from './config/keycloakAdmin';
import { AuthService } from './service/authService';
import { createAuthRoutes } from './routes/authRoutes';
import { DiscoveryRegistration } from './service/discoveryRegistration';
import { registerErrorHandlers } from './middleware/errorHandlers';

const FALSY_ENV_VALUES = new Set(['false', '0', 'no', 'off', '']);
const isEnvFalse = (value: string | undefined): boolean =>
  FALSY_ENV_VALUES.has(String(value ?? '').trim().toLowerCase());

const app: Express = express();
// Gateway sets X-Forwarded-For; express-rate-limit requires trust proxy to be enabled.
app.set('trust proxy', isEnvFalse(process.env.TRUST_PROXY) ? false : 1);
const PORT = parseInt(process.env.SERVER_PORT || '8081', 10);
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header) and dev environments where
      // CORS_ALLOWED_ORIGINS is intentionally left empty.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let activeDiscoveryRegistration: DiscoveryRegistration | null = null;

async function startServer() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    // Defensive: create auth-owned tables (e.g. vendor_signup_requests) when missing.
    await repairAuthSchema();

    console.log('Initializing Keycloak admin client...');
    const keycloakAdmin = await getKeycloakAdminClient();
    console.log('Keycloak admin client initialized');

    const authService = new AuthService(keycloakAdmin);

    app.use('/api/auth', createAuthRoutes(authService, keycloakAdmin));

    app.get('/', (req: Request, res: Response) => {
      res.json({ message: 'Auth Management Service API' });
    });

    registerErrorHandlers(app);

    app.listen(PORT, async () => {
      console.log(`=================================`);
      console.log(`Auth Management Service`);
      console.log(`=================================`);
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

      const discovery = new DiscoveryRegistration(DISCOVERY_URL);
      try {
        await discovery.register({
          serviceName: 'auth-management-service',
          host: process.env.SERVICE_HOST || 'localhost',
          port: PORT,
          healthCheckUrl: `http://${process.env.SERVICE_HOST || 'localhost'}:${PORT}/api/auth/public/health`,
          metadata: {
            protocol: 'http',
            version: '1.0.0'
          }
        });
        activeDiscoveryRegistration = discovery;
      } catch (error) {
        console.log('Discovery service not available, continuing without registration');
      }
      console.log(`=================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`${signal} signal received: closing HTTP server`);
  if (activeDiscoveryRegistration) {
    await activeDiscoveryRegistration.deregister();
  }
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

startServer();

