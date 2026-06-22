import axios, { AxiosInstance } from 'axios';

export interface ServiceRegistrationRequest {
  serviceName: string;
  host: string;
  port: number;
  healthCheckUrl?: string;
  metadata?: Record<string, string>;
}

export class DiscoveryRegistration {
  private discoveryUrl: string;
  private httpClient: AxiosInstance;
  private heartbeatInterval: number;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private registeredInstanceId?: string;
  private serviceName?: string;

  constructor(discoveryUrl?: string, heartbeatInterval: number = 30000) {
    this.discoveryUrl = discoveryUrl || process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
    this.heartbeatInterval = heartbeatInterval;
    this.httpClient = axios.create({ baseURL: this.discoveryUrl, timeout: 5000 });
  }

  async register(registration: ServiceRegistrationRequest, maxAttempts = 12): Promise<string> {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.httpClient.post(`/eureka/apps/${registration.serviceName}`, {
          host: registration.host,
          port: registration.port,
          healthCheckUrl: registration.healthCheckUrl,
          metadata: registration.metadata || {},
        });
        const instanceId: string | undefined = response.data?.instance?.instanceId;
        if (instanceId) {
          this.registeredInstanceId = instanceId;
          this.serviceName = registration.serviceName;
          this.startHeartbeat();
          return instanceId;
        }
        throw new Error('Invalid response from discovery service');
      } catch {
        if (attempt === maxAttempts) return '';
        await delay(Math.min(1000 * attempt, 10000));
      }
    }
    return '';
  }

  async deregister(): Promise<void> {
    if (!this.serviceName || !this.registeredInstanceId) return;
    this.stopHeartbeat();
    try {
      await this.httpClient.delete(`/eureka/apps/${this.serviceName}/${this.registeredInstanceId}`);
    } catch {
      // ignore
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.serviceName || !this.registeredInstanceId) return;
    try {
      await this.httpClient.put(`/eureka/apps/${this.serviceName}/${this.registeredInstanceId}`);
    } catch {
      // ignore
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }
}
