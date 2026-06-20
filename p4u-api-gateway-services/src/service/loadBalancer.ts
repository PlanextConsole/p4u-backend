import { ServiceInstance } from '../types/service';

export type LoadBalanceStrategy = 'round-robin' | 'random' | 'least-connections';

export class LoadBalancer {
  private currentIndex: Map<string, number> = new Map();
  private connectionCount: Map<string, Map<string, number>> = new Map();

  /**
   * Select an instance based on strategy
   */
  selectInstance(
    serviceName: string,
    instances: ServiceInstance[],
    strategy: LoadBalanceStrategy = 'round-robin'
  ): ServiceInstance | null {
    if (instances.length === 0) {
      return null;
    }

    // Filter only UP instances
    const upInstances = instances.filter(inst => inst.status === 'UP');
    if (upInstances.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(serviceName, upInstances);
      case 'random':
        return this.random(upInstances);
      case 'least-connections':
        return this.leastConnections(serviceName, upInstances);
      default:
        return this.roundRobin(serviceName, upInstances);
    }
  }

  /**
   * Round-robin load balancing
   */
  private roundRobin(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    const current = this.currentIndex.get(serviceName) || 0;
    const instance = instances[current % instances.length];
    this.currentIndex.set(serviceName, (current + 1) % instances.length);
    return instance;
  }

  /**
   * Random load balancing
   */
  private random(instances: ServiceInstance[]): ServiceInstance {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }

  /**
   * Least connections load balancing
   */
  private leastConnections(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    if (!this.connectionCount.has(serviceName)) {
      this.connectionCount.set(serviceName, new Map());
    }

    const counts = this.connectionCount.get(serviceName)!;
    
    // Initialize counts for new instances
    instances.forEach(inst => {
      if (!counts.has(inst.instanceId)) {
        counts.set(inst.instanceId, 0);
      }
    });

    // Find instance with least connections
    let minConnections = Infinity;
    let selectedInstance = instances[0];

    instances.forEach(inst => {
      const connections = counts.get(inst.instanceId) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = inst;
      }
    });

    // Increment connection count
    const currentCount = counts.get(selectedInstance.instanceId) || 0;
    counts.set(selectedInstance.instanceId, currentCount + 1);

    return selectedInstance;
  }

  /**
   * Decrement connection count (when connection closes)
   */
  decrementConnection(serviceName: string, instanceId: string): void {
    const counts = this.connectionCount.get(serviceName);
    if (counts) {
      const current = counts.get(instanceId) || 0;
      if (current > 0) {
        counts.set(instanceId, current - 1);
      }
    }
  }
}

