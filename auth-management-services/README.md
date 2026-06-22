# Auth Management Service - Node.js

A complete authentication and authorization service built with Node.js, TypeScript, Express, and Keycloak.

## 📋 Prerequisites

Before you start, make sure you have installed:
- **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
- **MySQL** - [Download here](https://dev.mysql.com/downloads/)
- **Keycloak** - [Download here](https://www.keycloak.org/downloads)

## 🚀 Quick Start Guide

### Step 1: Install Dependencies

Open terminal/command prompt in the project folder and run:

```bash
npm install
```

### Step 2: Configure Database

The database credentials are located in: **`src/config/database.ts`**

**Default Database Settings:**
- Host: `localhost`
- Port: `3306`
- Username: `root`
- Password: `root@123`
- Database Name: `p4u_admin_db` (shared with other P4U services; override with `DB_NAME` if needed)

**To change database credentials, you have two options:**

#### Option 1: Change Default Values (Easy for beginners)

Edit `src/config/database.ts` and change these lines:

```typescript
host: process.env.DB_HOST || 'localhost',           // Change 'localhost' to your DB host
username: process.env.DB_USERNAME || 'root',        // Change 'root' to your DB username
password: process.env.DB_PASSWORD || 'root@123',    // Change 'root@123' to your DB password
database: process.env.DB_NAME || 'p4u_admin_db',   // Same default as other P4U services
```

#### Option 2: Use Environment Variables (Recommended for production)

**Windows (PowerShell):**
```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_USERNAME="your_username"
$env:DB_PASSWORD="your_password"
$env:DB_NAME="your_database_name"
```

**Windows (Command Prompt):**
```cmd
set DB_HOST=localhost
set DB_PORT=3306
set DB_USERNAME=your_username
set DB_PASSWORD=your_password
set DB_NAME=your_database_name
```

**Linux/Mac:**
```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_USERNAME=your_username
export DB_PASSWORD=your_password
export DB_NAME=your_database_name
```

### Step 3: Create Database

Make sure MySQL is running and create the database:

```sql
CREATE DATABASE p4u_admin_db;
```

The application will automatically create tables when you start it (in development mode).

### Step 4: Configure Keycloak

Keycloak settings are in: **`src/config/keycloakAdmin.ts`** and **`src/service/authService.ts`**

**Default Keycloak Settings:**
- Server URL: `http://localhost:8180`
- Realm: `p4u-realm`
- Client ID: `auth-management-client`
- Client Secret: `C8Cstqoc8ns2zVPvPh2IcT6NfS1WWDUV`

**To change Keycloak settings, use environment variables:**

**Windows (PowerShell):**
```powershell
$env:KEYCLOAK_SERVER_URL="http://localhost:8180"
$env:KEYCLOAK_REALM="p4u-realm"
$env:KEYCLOAK_CLIENT_ID="auth-management-client"
$env:KEYCLOAK_CLIENT_SECRET="your-secret"
$env:KEYCLOAK_ADMIN_CLIENT_ID="auth-management-client"
$env:KEYCLOAK_ADMIN_CLIENT_SECRET="your-secret"
```

### Step 5: Build and Run

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

The server will start on `http://localhost:8080`

## 📁 Project Structure

```
auth-management-services/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.ts   # ⭐ DATABASE CREDENTIALS HERE
│   │   └── keycloakAdmin.ts
│   ├── constants/        # Constants
│   ├── dto/              # Data Transfer Objects
│   ├── entity/           # Database entities
│   ├── middleware/       # Express middleware
│   ├── repository/       # Database repositories
│   ├── routes/           # API routes
│   ├── service/          # Business logic
│   └── server.ts         # Main server file
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
```

## 🔑 Important Configuration Files

### Database Credentials
**Location:** `src/config/database.ts`

This file contains all database connection settings.

### Keycloak Configuration
**Location:** `src/config/keycloakAdmin.ts` and `src/service/authService.ts`

These files contain Keycloak server settings.

### Server Port
**Location:** `src/server.ts` (line 10)

Default port is `8080`. Change it by setting `SERVER_PORT` environment variable.

## 🧪 Test the API

Once the server is running, test these endpoints:

**Health Check:**
```bash
GET http://localhost:8080/api/auth/public/health
```

**Sign Up:**
```bash
POST http://localhost:8080/api/auth/public/signup
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "firstName": "Test",
  "lastName": "User",
  "userType": "CUSTOMER"
}
```

**Login:**
```bash
POST http://localhost:8080/api/auth/public/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}
```

## 🛠️ Troubleshooting

### Database Connection Error
- Make sure MySQL is running
- Check database credentials in `src/config/database.ts`
- Verify database exists: `CREATE DATABASE p4u_admin_db;`

### Keycloak Connection Error
- Make sure Keycloak is running on the configured port
- Check Keycloak settings in `src/config/keycloakAdmin.ts`
- Verify realm and client exist in Keycloak

### Port Already in Use
- Change the port in `src/server.ts` or set `SERVER_PORT` environment variable
- Or stop the application using port 8080

## 📝 Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled application
- `npm run dev` - Run in development mode with auto-reload

## 🔒 Environment Variables

All configuration can be set using environment variables. Here's a complete list:

**Database:**
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 3306)
- `DB_USERNAME` - Database username (default: root)
- `DB_PASSWORD` - Database password (default: root@123)
- `DB_NAME` - Database name (default: p4u_admin_db)

**Keycloak:**
- `KEYCLOAK_SERVER_URL` - Keycloak server URL (default: http://localhost:8180)
- `KEYCLOAK_REALM` - Keycloak realm (default: p4u-realm)
- `KEYCLOAK_CLIENT_ID` - Keycloak client ID (default: auth-management-client)
- `KEYCLOAK_CLIENT_SECRET` - Keycloak client secret
- `KEYCLOAK_ADMIN_CLIENT_ID` - Keycloak admin client ID
- `KEYCLOAK_ADMIN_CLIENT_SECRET` - Keycloak admin client secret

**Server:**
- `SERVER_PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production)

## 📚 Learn More

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [TypeORM Documentation](https://typeorm.io/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)

