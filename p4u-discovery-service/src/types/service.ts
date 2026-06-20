export interface ServiceInstance {
  instanceId: string;
  serviceName: string;
  host: string;
  port: number;
  status: 'UP' | 'DOWN' | 'OUT_OF_SERVICE';
  healthCheckUrl?: string;
  metadata?: Record<string, string>;
  registeredAt: Date;
  lastHeartbeat: Date;
}

export interface ServiceRegistration {
  serviceName: string;
  host: string;
  port: number;
  healthCheckUrl?: string;
  metadata?: Record<string, string>;
}

