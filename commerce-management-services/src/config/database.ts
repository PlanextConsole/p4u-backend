import { DataSource } from 'typeorm';
import { Order } from '../entities/Order';
import { Settlement } from '../entities/Settlement';
import { Cart } from '../entities/Cart';
import { CartItem } from '../entities/CartItem';
import { Coupon } from '../entities/Coupon';
import { CouponUsage } from '../entities/CouponUsage';
import { Booking } from '../entities/Booking';
import { Review } from '../entities/Review';
import { CustomerProfile } from '../entities/CustomerProfile';
import { PlatformVariable } from '../entities/PlatformVariable';
import { Vendor } from '../entities/Vendor';
import { VendorPlan } from '../entities/VendorPlan';
import { Product } from '../entities/Product';
import { ProductCategory } from '../entities/ProductCategory';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { CustomerReferral } from '../entities/CustomerReferral';

export function isPostgresDbType(value = process.env.DB_TYPE || 'mysql'): boolean {
  const dbType = value.toLowerCase();
  return dbType === 'postgres' || dbType === 'postgresql';
}

const dbType = isPostgresDbType() ? 'postgres' : 'mysql';
const defaultPort = dbType === 'postgres' ? '5432' : '3306';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || defaultPort, 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [
    Order,
    Settlement,
    Cart,
    CartItem,
    Coupon,
    CouponUsage,
    Booking,
    Review,
    CustomerProfile,
    PlatformVariable,
    Vendor,
    VendorPlan,
    Product,
    ProductCategory,
    RewardPointsLedger,
    CatalogServiceItem,
    CustomerReferral,
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
