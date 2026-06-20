import { Router, Request, Response } from 'express';
import { GatewayMiddleware } from '../middleware/gatewayMiddleware';

export const createGatewayRoutes = (gatewayMiddleware: GatewayMiddleware): Router => {
  const router = Router();

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    gatewayMiddleware.healthCheck(req, res);
  });

  // Auth Service Routes
  router.use('/api/auth', gatewayMiddleware.createServiceProxy('auth-management-service', {
    '^/api/auth': '/api/auth' // Keep the path as is
  }));

  router.use('/api/admin', gatewayMiddleware.createServiceProxy('admin-management-service', {
    '^/api/admin': '/api/admin'
  }));

  // Static files from admin uploads (user web + clients load images via gateway origin)
  router.use('/uploads', gatewayMiddleware.createServiceProxy('admin-management-service', {
    '^/uploads': '/uploads',
  }));

  router.use('/api/v1/catalog', gatewayMiddleware.createServiceProxy('catalog-management-service', {
    '^/api/v1/catalog': '/api/v1/catalog'
  }));

  router.use('/api/v1/content', gatewayMiddleware.createServiceProxy('content-management-service', {
    '^/api/v1/content': '/api/v1/content'
  }));

  router.use('/api/v1/profile', gatewayMiddleware.createServiceProxy('profile-management-service', {
    '^/api/v1/profile': '/api/v1/profile'
  }));

  router.use('/api/v1/commerce', gatewayMiddleware.createServiceProxy('commerce-management-service', {
    '^/api/v1/commerce': '/api/v1/commerce'
  }));

  router.use('/api/v1/payments', gatewayMiddleware.createServiceProxy('payment-management-service', {
    '^/api/v1/payments': '/api/v1/payments'
  }));

  router.use('/api/v1/notifications', gatewayMiddleware.createServiceProxy('notification-management-service', {
    '^/api/v1/notifications': '/api/v1/notifications'
  }));

  router.use('/api/v1/vendor', gatewayMiddleware.createServiceProxy('vendor-management-service', {
    '^/api/v1/vendor': '/api/v1/vendor'
  }));

  // Vendor portal image uploads (product thumbnails, service icons) — distinct from admin /uploads
  router.use('/vendor-uploads', gatewayMiddleware.createServiceProxy('vendor-management-service', {
    '^/vendor-uploads': '/uploads',
  }));

  router.use('/api/v1/social', gatewayMiddleware.createServiceProxy('socio-management-service', {
    '^/api/v1/social': '/api/v1/social'
  }));

  // Static media uploaded by users via the socio service (posts/stories).
  router.use('/socio-uploads', gatewayMiddleware.createServiceProxy('socio-management-service', {
    '^/socio-uploads': '/socio-uploads'
  }));

  // Default route
  router.get('/', (req: Request, res: Response) => {
    res.json({
      message: 'P4U API Gateway',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth/*',
        admin: '/api/admin/*',
        uploads: '/uploads/*',
        catalog: '/api/v1/catalog/*',
        content: '/api/v1/content/*',
        profile: '/api/v1/profile/*',
        commerce: '/api/v1/commerce/*',
        payments: '/api/v1/payments/*',
        notifications: '/api/v1/notifications/*',
        vendor: '/api/v1/vendor/*',
        vendorUploads: '/vendor-uploads/*',
        social: '/api/v1/social/*',
        socioUploads: '/socio-uploads/*'
      }
    });
  });

  return router;
};

