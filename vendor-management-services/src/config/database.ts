import { DataSource } from 'typeorm';
import { Vendor } from '../entities/Vendor';
import { Order } from '../entities/Order';
import { OrganizationOrder } from '../entities/OrganizationOrder';
import { VendorReview } from '../entities/VendorReview';
import { VendorRegistrationRequest } from '../entities/VendorRegistrationRequest';
import { VendorPlan } from '../entities/VendorPlan';
import { Product } from '../entities/Product';
import { ProductVariation } from '../entities/ProductVariation';
import { ProductCategory } from '../entities/ProductCategory';
import { Settlement } from '../entities/Settlement';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { CatalogVendorService } from '../entities/CatalogVendorService';
import { ServiceCategory } from '../entities/ServiceCategory';
import { VendorMediaFolder } from '../entities/VendorMediaFolder';
import { VendorMediaAsset } from '../entities/VendorMediaAsset';
import { DropshippingSupplier } from '../entities/DropshippingSupplier';
import { VendorDropshippingSettings } from '../entities/VendorDropshippingSettings';
import { DropshippingOrder } from '../entities/DropshippingOrder';
import { PlatformSettings } from '../entities/PlatformSettings';
import { UserNotification } from '../entities/UserNotification';
import { Booking } from '../entities/Booking';

const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres' ? 'postgres' : 'mysql';
const defaultPort = dbType === 'postgres' ? '5432' : '3306';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || defaultPort, 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [
    Vendor,
    Order,
    OrganizationOrder,
    VendorReview,
    VendorRegistrationRequest,
    VendorPlan,
    Product,
    ProductVariation,
    ProductCategory,
    Settlement,
    CatalogServiceItem,
    CatalogVendorService,
    ServiceCategory,
    VendorMediaFolder,
    VendorMediaAsset,
    DropshippingSupplier,
    VendorDropshippingSettings,
    DropshippingOrder,
    PlatformSettings,
    UserNotification,
    Booking,
  ],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.NODE_ENV === 'development',
});
