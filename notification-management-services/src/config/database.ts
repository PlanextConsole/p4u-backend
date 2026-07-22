import { DataSource } from 'typeorm';
import { UserNotification } from '../entities/UserNotification';
import { UserDevice } from '../entities/UserDevice';

const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres' ? 'postgres' : 'mysql';
const defaultPort = dbType === 'postgres' ? '5432' : '3306';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || defaultPort, 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [UserNotification, UserDevice],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
