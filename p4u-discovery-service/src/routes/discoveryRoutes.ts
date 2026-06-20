import { Router, Request, Response } from 'express';
import { ServiceRegistry } from '../service/registry';
import { ServiceRegistration } from '../types/service';

export const createDiscoveryRoutes = (registry: ServiceRegistry): Router => {
  const router = Router();

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'UP',
      message: 'Discovery Service is running',
      timestamp: new Date().toISOString()
    });
  });

  // Register a service instance
  router.post('/eureka/apps/:serviceName', (req: Request, res: Response) => {
    try {
      const { serviceName } = req.params;
      const registration: ServiceRegistration = {
        serviceName,
        host: req.body.host || req.body.ipAddr || req.ip,
        port: req.body.port,
        healthCheckUrl: req.body.healthCheckUrl || req.body.healthCheckUrl,
        metadata: req.body.metadata || {},
      };

      if (!registration.port) {
        return res.status(400).json({ 
          error: 'Port is required',
          message: 'Service registration must include a port number'
        });
      }

      const instance = registry.register(registration);
      res.status(201).json({
        message: 'Service registered successfully',
        instance
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Registration failed',
        message: error.message 
      });
    }
  });

  // Deregister a service instance
  router.delete('/eureka/apps/:serviceName/:instanceId', (req: Request, res: Response) => {
    try {
      const { serviceName, instanceId } = req.params;
      const success = registry.deregister(serviceName, instanceId);
      
      if (success) {
        res.json({ message: 'Service deregistered successfully' });
      } else {
        res.status(404).json({ 
          error: 'Service not found',
          message: `Service instance ${instanceId} not found for service ${serviceName}`
        });
      }
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Deregistration failed',
        message: error.message 
      });
    }
  });

  // Send heartbeat
  router.put('/eureka/apps/:serviceName/:instanceId', (req: Request, res: Response) => {
    try {
      const { serviceName, instanceId } = req.params;
      const success = registry.updateHeartbeat(serviceName, instanceId);
      
      if (success) {
        res.status(200).json({ message: 'Heartbeat received' });
      } else {
        res.status(404).json({ 
          error: 'Service not found',
          message: `Service instance ${instanceId} not found for service ${serviceName}`
        });
      }
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Heartbeat update failed',
        message: error.message 
      });
    }
  });

  // Get all services
  router.get('/eureka/apps', (req: Request, res: Response) => {
    try {
      const services = registry.getAllServices();
      const applications = {
        applications: {
          application: services.map(serviceName => ({
            name: serviceName,
            instance: registry.getInstances(serviceName)
          }))
        }
      };
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Failed to retrieve services',
        message: error.message 
      });
    }
  });

  // Get instances of a specific service
  router.get('/eureka/apps/:serviceName', (req: Request, res: Response) => {
    try {
      const { serviceName } = req.params;
      const instances = registry.getInstances(serviceName);
      
      if (instances.length === 0) {
        return res.status(404).json({ 
          error: 'Service not found',
          message: `No instances found for service ${serviceName}`
        });
      }

      res.json({
        application: {
          name: serviceName,
          instance: instances
        }
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Failed to retrieve service instances',
        message: error.message 
      });
    }
  });

  // Get a specific service instance
  router.get('/eureka/apps/:serviceName/:instanceId', (req: Request, res: Response) => {
    try {
      const { serviceName, instanceId } = req.params;
      const instance = registry.getInstance(serviceName, instanceId);
      
      if (!instance) {
        return res.status(404).json({ 
          error: 'Instance not found',
          message: `Instance ${instanceId} not found for service ${serviceName}`
        });
      }

      res.json({ instance });
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Failed to retrieve instance',
        message: error.message 
      });
    }
  });

  // Get service registry status
  router.get('/status', (req: Request, res: Response) => {
    try {
      const allInstances = registry.getAllInstances();
      const services = registry.getAllServices();
      
      res.json({
        status: 'UP',
        totalServices: services.length,
        totalInstances: allInstances.length,
        services: services.map(serviceName => ({
          name: serviceName,
          instanceCount: registry.getInstances(serviceName).length
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Failed to retrieve status',
        message: error.message 
      });
    }
  });

  return router;
};

