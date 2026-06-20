import { ServiceInstance, ServiceRegistration } from '../types/service';

export class ServiceRegistry {
  private services: Map<string, ServiceInstance[]> = new Map();
  private heartbeatInterval: number;
  private serviceTimeout: number;
  private cleanupJob?: ReturnType<typeof setInterval>;

  constructor(heartbeatInterval: number = 30000, serviceTimeout: number = 90000) {
    this.heartbeatInterval = heartbeatInterval;
    this.serviceTimeout = serviceTimeout;
    this.startCleanupJob();
  }

  /**
   * Register a new service instance
   */
  register(registration: ServiceRegistration): ServiceInstance {
    const instanceId = `${registration.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const instance: ServiceInstance = {
      instanceId,
      serviceName: registration.serviceName,
      host: registration.host,
      port: registration.port,
      status: 'UP',
      healthCheckUrl: registration.healthCheckUrl,
      metadata: registration.metadata || {},
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
    };

    if (!this.services.has(registration.serviceName)) {
      this.services.set(registration.serviceName, []);
    }

    this.services.get(registration.serviceName)!.push(instance);
    console.log(`Service registered: ${instance.serviceName} - ${instance.instanceId} at ${instance.host}:${instance.port}`);
    
    return instance;
  }

  /**
   * Deregister a service instance
   */
  deregister(serviceName: string, instanceId: string): boolean {
    const instances = this.services.get(serviceName);
    if (!instances) {
      return false;
    }

    const index = instances.findIndex(inst => inst.instanceId === instanceId);
    if (index === -1) {
      return false;
    }

    const removed = instances.splice(index, 1)[0];
    console.log(`Service deregistered: ${removed.serviceName} - ${removed.instanceId}`);

    if (instances.length === 0) {
      this.services.delete(serviceName);
    }

    return true;
  }

  /**
   * Update heartbeat for a service instance
   */
  updateHeartbeat(serviceName: string, instanceId: string): boolean {
    const instances = this.services.get(serviceName);
    if (!instances) {
      return false;
    }

    const instance = instances.find(inst => inst.instanceId === instanceId);
    if (!instance) {
      return false;
    }

    instance.lastHeartbeat = new Date();
    instance.status = 'UP';
    return true;
  }

  /**
   * Get all instances of a service
   */
  getInstances(serviceName: string): ServiceInstance[] {
    const instances = this.services.get(serviceName) || [];
    // Return only UP instances
    return instances.filter(inst => inst.status === 'UP');
  }

  /**
   * Get all registered services
   */
  getAllServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get all service instances
   */
  getAllInstances(): ServiceInstance[] {
    const allInstances: ServiceInstance[] = [];
    this.services.forEach(instances => {
      allInstances.push(...instances);
    });
    return allInstances;
  }

  /**
   * Get service instance by ID
   */
  getInstance(serviceName: string, instanceId: string): ServiceInstance | undefined {
    const instances = this.services.get(serviceName);
    if (!instances) {
      return undefined;
    }
    return instances.find(inst => inst.instanceId === instanceId);
  }

  /**
   * Start cleanup job to remove stale services
   */
  private startCleanupJob(): void {
    // Run cleanup every 30 seconds
    this.cleanupJob = setInterval(() => {
      this.cleanupStaleServices();
    }, 30000);
  }

  /**
   * Clean up services that haven't sent heartbeat
   */
  private cleanupStaleServices(): void {
    const now = new Date().getTime();
    let cleanedCount = 0;

    this.services.forEach((instances, serviceName) => {
      const staleInstances = instances.filter(instance => {
        const lastHeartbeat = instance.lastHeartbeat.getTime();
        const timeSinceHeartbeat = now - lastHeartbeat;
        return timeSinceHeartbeat > this.serviceTimeout;
      });

      staleInstances.forEach(instance => {
        instance.status = 'DOWN';
        console.log(`Marking service as DOWN due to timeout: ${instance.serviceName} - ${instance.instanceId}`);
        cleanedCount++;
      });

      // Remove DOWN instances after marking
      const activeInstances = instances.filter(inst => inst.status === 'UP');
      if (activeInstances.length === 0) {
        this.services.delete(serviceName);
      } else {
        this.services.set(serviceName, activeInstances);
      }
    });

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} stale service instance(s)`);
    }
  }

  /**
   * Stop cleanup job
   */
  stop(): void {
    if (this.cleanupJob) {
      clearInterval(this.cleanupJob);
    }
  }
}

