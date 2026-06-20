import { DataSource } from 'typeorm';
import { Customer } from '../entities/Customer';
import { CustomerAddress } from '../entities/CustomerAddress';
import { WishlistItem } from '../entities/WishlistItem';
import { Referral } from '../entities/Referral';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CommerceSettlement } from '../entities/CommerceSettlement';
import { PlatformVariable } from '../entities/PlatformVariable';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [Customer, CustomerAddress, WishlistItem, Referral, RewardPointsLedger, CommerceSettlement, PlatformVariable],
  // Schema is owned by admin migrations; avoid auto-altering shared admin tables.
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
