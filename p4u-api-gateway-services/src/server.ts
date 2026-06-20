import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
import { DiscoveryClient } from './service/discoveryClient';
import { LoadBalancer } from './service/loadBalancer';
import { GatewayMiddleware } from './middleware/gatewayMiddleware';
import { createGatewayRoutes } from './routes/gatewayRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.SERVER_PORT || 8080;
const DISCOVERY_URL = process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
const DISCOVERY_REFRESH_INTERVAL = parseInt(process.env.DISCOVERY_REFRESH_INTERVAL || '30000');

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'), // limit each IP to 500 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
// Skip body parsing for multipart requests so the raw stream passes through to upstream services
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) return next();
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) return next();
  express.urlencoded({ extended: true })(req, res, next);
});
app.use(limiter);

// Initialize services
const discoveryClient = new DiscoveryClient(DISCOVERY_URL, DISCOVERY_REFRESH_INTERVAL);
const loadBalancer = new LoadBalancer();
const gatewayMiddleware = new GatewayMiddleware(discoveryClient, loadBalancer);

// Setup routes
app.use('/', createGatewayRoutes(gatewayMiddleware));

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Gateway Error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`P4U API Gateway Service`);
  console.log(`=================================`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Discovery Service: ${DISCOVERY_URL}`);
  console.log(`Refresh Interval: ${DISCOVERY_REFRESH_INTERVAL}ms`);
  console.log(`=================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  discoveryClient.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  discoveryClient.stop();
  process.exit(0);
});

