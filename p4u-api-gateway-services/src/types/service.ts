export interface ServiceInstance {
  instanceId: string;
  serviceName: string;
  host: string;
  port: number;
  status: 'UP' | 'DOWN' | 'OUT_OF_SERVICE';
  healthCheckUrl?: string;
  metadata?: Record<string, string>;
  registeredAt: string;
  lastHeartbeat: string;
}

export interface ServiceRegistryResponse {
  applications: {
    application: Array<{
      name: string;
      instance: ServiceInstance[];
    }>;
  };
}

