import { DataSource } from 'typeorm';
import { ProductCategory } from '../entities/ProductCategory';
import { ProductSubcategory } from '../entities/ProductSubcategory';
import { ServiceCategory } from '../entities/ServiceCategory';
import { ServiceSubcategory } from '../entities/ServiceSubcategory';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { Vendor } from '../entities/Vendor';
import { Product } from '../entities/Product';
import { ProductVariation } from '../entities/ProductVariation';
import { VendorService } from '../entities/VendorService';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [ProductCategory, ProductSubcategory, ServiceCategory, ServiceSubcategory, CatalogServiceItem, Vendor, Product, ProductVariation, VendorService],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
});
