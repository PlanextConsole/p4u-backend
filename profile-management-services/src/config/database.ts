import { DataSource } from 'typeorm';
import { Customer } from '../entities/Customer';
import { CustomerAddress } from '../entities/CustomerAddress';
import { WishlistItem } from '../entities/WishlistItem';
import { Referral } from '../entities/Referral';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CommerceSettlement } from '../entities/CommerceSettlement';
import { PlatformVariable } from '../entities/PlatformVariable';

const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres' ? 'postgres' : 'mysql';
const defaultPort = dbType === 'postgres' ? '5432' : '3306';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || defaultPort, 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [Customer, CustomerAddress, WishlistItem, Referral, RewardPointsLedger, CommerceSettlement, PlatformVariable],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
