import { Request, Response, NextFunction } from 'express';
import { DiscoveryClient } from '../service/discoveryClient';
import { LoadBalancer } from '../service/loadBalancer';
import { createProxyMiddleware, Options, fixRequestBody } from 'http-proxy-middleware';

export class GatewayMiddleware {
  private discoveryClient: DiscoveryClient;
  private loadBalancer: LoadBalancer;

  constructor(discoveryClient: DiscoveryClient, loadBalancer: LoadBalancer) {
    this.discoveryClient = discoveryClient;
    this.loadBalancer = loadBalancer;
  }

  /**
   * Create proxy middleware for a service
   */
  createServiceProxy(serviceName: string, pathRewrite?: Record<string, string>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get service instances
        const instances = await this.discoveryClient.getServiceInstances(serviceName);
        
        if (instances.length === 0) {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: `No instances available for service: ${serviceName}`
          });
        }

        // Select instance using load balancer
        const instance = this.loadBalancer.selectInstance(serviceName, instances, 'round-robin');
        
        if (!instance) {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: `No healthy instances available for service: ${serviceName}`
          });
        }

        // Build target URL
        const protocol = instance.metadata?.protocol || 'http';
        const target = `${protocol}://${instance.host}:${instance.port}`;

        console.log(`Proxying request to ${serviceName} at ${target}${req.path}`);

        // Create proxy options
        const proxyOptions: Options = {
          target,
          changeOrigin: true,
          pathRewrite: pathRewrite || {},
          timeout: 60000, // 60 seconds timeout
          proxyTimeout: 60000, // 60 seconds proxy timeout
          logLevel: 'debug',
          onProxyReq: (proxyReq, req, res) => {
            // Add original host header
            proxyReq.setHeader('X-Forwarded-Host', req.get('host') || '');
            proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
            proxyReq.setHeader('X-Forwarded-For', req.ip || '');
            proxyReq.setHeader('X-Forwarded-Service', serviceName);

            // express.json() consumes the stream; use library helper so upstream gets a valid body
            // (manual write + default proxy piping can duplicate or corrupt JSON → 400 on auth).
            const expressReq = req as Request & { body?: unknown };
            const method = (req.method || '').toUpperCase();
            const hasBodyMethod =
              method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
            const contentType = String(req.headers['content-type'] || '');
            if (contentType && !proxyReq.getHeader('Content-Type')) {
              proxyReq.setHeader('Content-Type', contentType);
            }
            if (hasBodyMethod && expressReq.body != null && contentType.includes('application/json')) {
              fixRequestBody(proxyReq, req);
            }

            console.log(`Proxy request: ${req.method} ${req.path} -> ${target}${req.path}`);
          },
          onProxyRes: (proxyRes, req, res) => {
            console.log(`Proxy response: ${proxyRes.statusCode} for ${req.path}`);
          },
          onError: (err, req, res) => {
            console.error(`Proxy error for ${serviceName}:`, err.message);
            this.discoveryClient.invalidateService(serviceName);
            if (!res.headersSent) {
              res.status(502).json({
                error: 'Bad Gateway',
                message: `Failed to connect to service: ${serviceName}`
              });
            }
          },
        };

        // Create and use proxy middleware
        const proxy = createProxyMiddleware(proxyOptions);
        proxy(req, res, next);
      } catch (error: any) {
        console.error(`Error proxying to ${serviceName}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: `Failed to route request to ${serviceName}: ${error.message}`
          });
        }
      }
    };
  }

  /**
   * Health check middleware
   */
  healthCheck(req: Request, res: Response) {
    res.json({
      status: 'UP',
      message: 'API Gateway is running',
      timestamp: new Date().toISOString()
    });
  }
}

