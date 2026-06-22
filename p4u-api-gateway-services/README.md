# P4U API Gateway Service

API Gateway microservice for P4U using Node.js, TypeScript, and Express.

## Overview

This service provides API Gateway functionality for P4U microservices architecture. It routes requests to appropriate microservices, provides load balancing, and integrates with the service discovery service.

### Features

- Dynamic service discovery integration
- Request routing and proxying
- Load balancing (round-robin, random, least-connections)
- Rate limiting
- Health checks
- Service instance caching

## Prerequisites

- **Node.js 18+** and **npm**
- **Discovery Service** running (p4u-discovery-service)
- Check: `node -v` and `npm -v`
- Download: [Node.js](https://nodejs.org/)

## Installation

1. **Install dependencies:**
   ```bash
   cd p4u-api-gateway-services
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file:
   ```env
   SERVER_PORT=8080
   NODE_ENV=development
   DISCOVERY_SERVICE_URL=http://localhost:8761
   DISCOVERY_REFRESH_INTERVAL=30000
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
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

The gateway will run on `http://localhost:8080` by default.

## API Endpoints

### Health Check
```http
GET /health
```

### Gateway Info
```http
GET /
```

### Routed Services

All requests to `/api/*` are routed to the appropriate microservices:

- `/api/auth/*` → `auth-management-service`

## Configuration

- **SERVER_PORT**: Port for the API Gateway (default: 8080)
- **DISCOVERY_SERVICE_URL**: URL of the discovery service (default: http://localhost:8761)
- **DISCOVERY_REFRESH_INTERVAL**: How often to refresh service registry in ms (default: 30000)
- **RATE_LIMIT_WINDOW_MS**: Rate limit window in milliseconds (default: 900000 = 15 minutes)
- **RATE_LIMIT_MAX_REQUESTS**: Max requests per window per IP (default: 100)

## Load Balancing

The gateway supports three load balancing strategies:
- **round-robin** (default): Distributes requests evenly
- **random**: Randomly selects an instance
- **least-connections**: Selects instance with fewest active connections

## Service Discovery Integration

The gateway automatically:
1. Connects to the discovery service on startup
2. Periodically refreshes the service registry
3. Routes requests to healthy service instances
4. Handles service unavailability gracefully

## Adding New Services

To add a new service route, edit `src/routes/gatewayRoutes.ts`:

```typescript
// Add new service route
router.use('/api/products', gatewayMiddleware.createServiceProxy('product-service'));
router.use('/api/orders', gatewayMiddleware.createServiceProxy('order-service'));
```

Make sure the service is registered with the discovery service with the correct service name.

## Architecture

```
Client Request
    ↓
API Gateway (Port 8080)
    ↓
Discovery Service (Port 8761) - Get service instances
    ↓
Load Balancer - Select instance
    ↓
Proxy to Microservice
    ↓
Response back to Client
```

## License

ISC

