import { DataSource } from 'typeorm';
import { Banner } from '../entities/Banner';
import { PopupBanner } from '../entities/PopupBanner';
import { ClassifiedProduct } from '../entities/ClassifiedProduct';
import { ClassifiedCategory } from '../entities/ClassifiedCategory';
import { Post } from '../entities/Post';
import { WebsiteQuery } from '../entities/WebsiteQuery';
import { Brand } from '../entities/Brand';
import { FeaturedProduct } from '../entities/FeaturedProduct';
import { ServiceHighlight } from '../entities/ServiceHighlight';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [Banner, PopupBanner, ClassifiedProduct, ClassifiedCategory, Post, WebsiteQuery, Brand, FeaturedProduct, ServiceHighlight],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
});
