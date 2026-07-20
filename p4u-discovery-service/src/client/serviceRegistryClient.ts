import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

export interface ServiceRegistrationRequest {
  serviceName: string;
  host: string;
  port: number;
  healthCheckUrl?: string;
  metadata?: Record<string, string>;
}

export class ServiceRegistryClient {
  private discoveryUrl: string;
  private httpClient: AxiosInstance;
  private heartbeatInterval: number;
  private heartbeatTimer?: NodeJS.Timeout;
  private registeredInstanceId?: string;
  private serviceName?: string;

  constructor(discoveryUrl?: string, heartbeatInterval: number = 30000) {
    this.discoveryUrl = discoveryUrl || process.env.DISCOVERY_SERVICE_URL || 'http://localhost:8761';
    this.heartbeatInterval = heartbeatInterval;
    this.httpClient = axios.create({
      baseURL: this.discoveryUrl,
      timeout: 5000,
    });
  }

  /**
   * Register service with discovery service
   */
  async register(registration: ServiceRegistrationRequest): Promise<string> {
    try {
      const response = await this.httpClient.post(
        `/eureka/apps/${registration.serviceName}`,
        {
          host: registration.host,
          port: registration.port,
          healthCheckUrl: registration.healthCheckUrl,
          metadata: registration.metadata || {},
        }
      );

      const instanceId = response.data?.instance?.instanceId;
      if (typeof instanceId === 'string' && instanceId.trim()) {
        this.registeredInstanceId = instanceId;
        this.serviceName = registration.serviceName;
        
        // Start sending heartbeats
        this.startHeartbeat();
        
        console.log(`Service registered: ${registration.serviceName} - ${this.registeredInstanceId}`);
        return instanceId;
      }

      throw new Error('Invalid response from discovery service');
    } catch (error: any) {
      console.error('Failed to register service:', error.message);
      throw error;
    }
  }

  /**
   * Deregister service
   */
  async deregister(): Promise<void> {
    if (!this.serviceName || !this.registeredInstanceId) {
      return;
    }

    this.stopHeartbeat();

    try {
      await this.httpClient.delete(
        `/eureka/apps/${this.serviceName}/${this.registeredInstanceId}`
      );
      console.log(`Service deregistered: ${this.serviceName} - ${this.registeredInstanceId}`);
    } catch (error: any) {
      console.error('Failed to deregister service:', error.message);
    }
  }

  /**
   * Send heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.serviceName || !this.registeredInstanceId) {
      return;
    }

    try {
      await this.httpClient.put(
        `/eureka/apps/${this.serviceName}/${this.registeredInstanceId}`
      );
    } catch (error: any) {
      console.error('Failed to send heartbeat:', error.message);
    }
  }

  /**
   * Start sending periodic heartbeats
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Stop sending heartbeats
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }
}

