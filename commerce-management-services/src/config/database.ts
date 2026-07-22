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
import { FoodMenuCategory } from '../entities/FoodMenuCategory';
import { FoodMenuItem } from '../entities/FoodMenuItem';
import { FoodOrder } from '../entities/FoodOrder';
import { FoodOrderChat } from '../entities/FoodOrderChat';
import { FoodOrderStatusHistory } from '../entities/FoodOrderStatusHistory';
import { FoodRestaurant } from '../entities/FoodRestaurant';
import { FoodReview } from '../entities/FoodReview';
import { PropertyListing } from '../entities/PropertyListing';

export function isPostgresDbType(value = process.env.DB_TYPE || 'postgres'): boolean {
  const dbType = value.toLowerCase();
  return dbType === 'postgres' || dbType === 'postgresql';
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
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
    FoodRestaurant,
    FoodMenuCategory,
    FoodMenuItem,
    FoodOrder,
    FoodOrderStatusHistory,
    FoodOrderChat,
    FoodReview,
    PropertyListing,
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
