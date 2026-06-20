import { DataSource } from 'typeorm';
import { Vendor } from '../entities/Vendor';
import { Order } from '../entities/Order';
import { OrganizationOrder } from '../entities/OrganizationOrder';
import { VendorReview } from '../entities/VendorReview';
import { VendorRegistrationRequest } from '../entities/VendorRegistrationRequest';
import { VendorPlan } from '../entities/VendorPlan';
import { Product } from '../entities/Product';
import { ProductCategory } from '../entities/ProductCategory';
import { Settlement } from '../entities/Settlement';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { CatalogVendorService } from '../entities/CatalogVendorService';
import { ServiceCategory } from '../entities/ServiceCategory';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
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
    ProductCategory,
    Settlement,
    CatalogServiceItem,
    CatalogVendorService,
    ServiceCategory,
  ],
  // Disable implicit DDL by default to avoid cross-service schema drift.
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.NODE_ENV === 'development',
});
