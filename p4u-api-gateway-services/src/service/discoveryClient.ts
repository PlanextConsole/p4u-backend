import axios, { AxiosInstance } from 'axios';
import { ServiceInstance, ServiceRegistryResponse } from '../types/service';
import * as dotenv from 'dotenv';

dotenv.config();

export class DiscoveryClient {
  private discoveryUrl: string;
  private httpClient: AxiosInstance;
  private serviceCache: Map<string, ServiceInstance[]> = new Map();
  private refreshInterval: number;
  private refreshTimer?: NodeJS.Timeout;

  constructor(discoveryUrl?: string, refreshInterval: number = 30000) {
    this.discoveryUrl = discoveryUrl || process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
    this.refreshInterval = refreshInterval;
    this.httpClient = axios.create({
      baseURL: this.discoveryUrl,
      timeout: 5000,
    });

    // Start periodic refresh
    this.startRefresh();
  }

  /**
   * Get all instances of a service
   */
  async getServiceInstances(serviceName: string): Promise<ServiceInstance[]> {
    // Check cache first
    if (this.serviceCache.has(serviceName)) {
      const cached = this.serviceCache.get(serviceName)!;
      const upInstances = cached.filter(inst => inst.status === 'UP');
      if (upInstances.length > 0) {
        return upInstances;
      }
    }

    // Cache miss or no UP instances - fetch from discovery service
    console.log(`Fetching service instances for ${serviceName} from Discovery Service...`);
    try {
      const response = await this.httpClient.get<{
        application: {
          name: string;
          instance: ServiceInstance[];
        };
      }>(`/eureka/apps/${serviceName}`);

      if (response.data && response.data.application) {
        const instances = response.data.application.instance || [];
        this.serviceCache.set(serviceName, instances);
        const upInstances = instances.filter(inst => inst.status === 'UP');
        console.log(`Found ${upInstances.length} UP instance(s) for ${serviceName}`);
        return upInstances;
      }

      console.warn(`No instances found for ${serviceName} in Discovery Service`);
      return [];
    } catch (error: any) {
      console.error(`Failed to fetch service instances for ${serviceName}:`, error.message);
      // Try to refresh all services and check cache again
      await this.refreshServices();
      const cached = this.serviceCache.get(serviceName);
      if (cached) {
        return cached.filter(inst => inst.status === 'UP');
      }
      return [];
    }
  }

  /**
   * Get a single service instance (for load balancing)
   */
  async getServiceInstance(serviceName: string, strategy: 'round-robin' | 'random' = 'round-robin'): Promise<ServiceInstance | null> {
    const instances = await this.getServiceInstances(serviceName);
    
    if (instances.length === 0) {
      return null;
    }

    if (strategy === 'random') {
      return instances[Math.floor(Math.random() * instances.length)];
    }

    // Round-robin: simple implementation using timestamp
    const index = Date.now() % instances.length;
    return instances[index];
  }

  /**
   * Get service URL
   */
  async getServiceUrl(serviceName: string, path: string = ''): Promise<string | null> {
    const instance = await this.getServiceInstance(serviceName);
    if (!instance) {
      return null;
    }

    const protocol = instance.metadata?.protocol || 'http';
    return `${protocol}://${instance.host}:${instance.port}${path}`;
  }

  /**
   * Refresh service registry cache
   */
  async refreshServices(): Promise<void> {
    try {
      const response = await this.httpClient.get<ServiceRegistryResponse>('/eureka/apps');
      
      if (response.data && response.data.applications) {
        this.serviceCache.clear();
        
        response.data.applications.application.forEach(app => {
          const instances = app.instance || [];
          this.serviceCache.set(app.name, instances);
          const upCount = instances.filter(inst => inst.status === 'UP').length;
          console.log(`  - ${app.name}: ${upCount}/${instances.length} instance(s) UP`);
        });

        console.log(`Service registry refreshed. Found ${this.serviceCache.size} service(s)`);
      } else {
        console.warn('Service registry refresh returned empty data');
      }
    } catch (error: any) {
      console.error('Failed to refresh service registry:', error.message);
      if (error.response) {
        console.error(`  Status: ${error.response.status}, Data:`, error.response.data);
      }
    }
  }

  /**
   * Start periodic refresh
   */
  private startRefresh(): void {
    // Initial refresh (wait for it to complete)
    this.refreshServices().then(() => {
      console.log('Initial service registry refresh completed');
    }).catch((error) => {
      console.error('Initial service registry refresh failed:', error.message);
    });

    // Periodic refresh
    this.refreshTimer = setInterval(() => {
      this.refreshServices();
    }, this.refreshInterval);
  }

  /**
   * Stop refresh timer
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
}

