import { DataSource } from 'typeorm';
import { User } from '../entity/User';
import { CustomerProfile } from '../entity/CustomerProfile';
import { VendorRegistrationRequest } from '../entity/VendorRegistrationRequest';
import { CatalogVendor } from '../entity/CatalogVendor';
import { CustomerOccupation } from '../entity/CustomerOccupation';
import { RewardPointsLedger } from '../entity/RewardPointsLedger';
import { PlatformVariable } from '../entity/PlatformVariable';
import { CommerceSettlement } from '../entity/CommerceSettlement';

const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres' ? 'postgres' : 'mysql';
const defaultPort = dbType === 'postgres' ? '5432' : '3306';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || defaultPort, 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [User, CustomerProfile, VendorRegistrationRequest, CatalogVendor, CustomerOccupation, RewardPointsLedger, PlatformVariable, CommerceSettlement],
  // Prevent accidental DDL races across services; enable only when explicitly requested.
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.NODE_ENV === 'development',
});
