# P4U Discovery Service

Service Discovery microservice for P4U using Node.js, TypeScript, and Express.

## Overview

This service provides service discovery functionality for P4U microservices architecture. It allows services to register themselves and discover other services dynamically.

### Features

- Service registration and deregistration
- Health check and heartbeat monitoring
- Automatic cleanup of stale services
- Eureka-compatible API endpoints
- Service instance discovery
- Load balancing support

## Prerequisites

- **Node.js 18+** and **npm**
- Check: `node -v` and `npm -v`
- Download: [Node.js](https://nodejs.org/)

## Installation

1. **Install dependencies:**
   ```bash
   cd p4u-discovery-service
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file (or copy from `.env.example`):
   ```env
   SERVER_PORT=8761
   NODE_ENV=development
   HEARTBEAT_INTERVAL=30000
   SERVICE_TIMEOUT=90000
   ```

## Running the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The service will run on `http://localhost:8761` by default.

## API Endpoints

### Health Check
```http
GET /health
```

### Register Service
```http
POST /eureka/apps/:serviceName
Content-Type: application/json

{
  "host": "localhost",
  "port": 8080,
  "healthCheckUrl": "http://localhost:8080/health",
  "metadata": {
    "protocol": "http"
  }
}
```

### Deregister Service
```http
DELETE /eureka/apps/:serviceName/:instanceId
```

### Send Heartbeat
```http
PUT /eureka/apps/:serviceName/:instanceId
```

### Get All Services
```http
GET /eureka/apps
```

### Get Service Instances
```http
GET /eureka/apps/:serviceName
```

### Get Service Instance
```http
GET /eureka/apps/:serviceName/:instanceId
```

### Get Registry Status
```http
GET /status
```

## Service Registration Example

```typescript
import { ServiceRegistryClient } from './client/serviceRegistryClient';

const client = new ServiceRegistryClient('http://localhost:8761');

// Register service
await client.register({
  serviceName: 'auth-management-service',
  host: 'localhost',
  port: 8080,
  healthCheckUrl: 'http://localhost:8080/api/auth/public/health',
  metadata: {
    protocol: 'http'
  }
});

// On shutdown, deregister
process.on('SIGTERM', async () => {
  await client.deregister();
  process.exit(0);
});
```

## Configuration

- **SERVER_PORT**: Port for the discovery service (default: 8761)
- **HEARTBEAT_INTERVAL**: How often services should send heartbeats in ms (default: 30000)
- **SERVICE_TIMEOUT**: Time before marking a service as DOWN in ms (default: 90000)

## Architecture

The discovery service maintains an in-memory registry of all registered services. Services must:
1. Register on startup
2. Send periodic heartbeats
3. Deregister on shutdown

Services that don't send heartbeats within the timeout period are automatically marked as DOWN and removed from the registry.

## License

ISC

