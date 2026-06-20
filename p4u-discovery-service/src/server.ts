import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { ServiceRegistry } from './service/registry';
import { createDiscoveryRoutes } from './routes/discoveryRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.SERVER_PORT || 8761;
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '30000');
const SERVICE_TIMEOUT = parseInt(process.env.SERVICE_TIMEOUT || '90000');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize service registry
const registry = new ServiceRegistry(HEARTBEAT_INTERVAL, SERVICE_TIMEOUT);

// Setup routes
app.use('/', createDiscoveryRoutes(registry));

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'P4U Service Discovery Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      status: '/status',
      register: 'POST /eureka/apps/:serviceName',
      deregister: 'DELETE /eureka/apps/:serviceName/:instanceId',
      heartbeat: 'PUT /eureka/apps/:serviceName/:instanceId',
      getServices: 'GET /eureka/apps',
      getService: 'GET /eureka/apps/:serviceName',
      getInstance: 'GET /eureka/apps/:serviceName/:instanceId'
    }
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`P4U Discovery Service`);
  console.log(`=================================`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Heartbeat Interval: ${HEARTBEAT_INTERVAL}ms`);
  console.log(`Service Timeout: ${SERVICE_TIMEOUT}ms`);
  console.log(`=================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  registry.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  registry.stop();
  process.exit(0);
});

