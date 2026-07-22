import { createConnection, RowDataPacket } from 'mysql2/promise';
import { isPostgresDbType } from './database';



/**
 * Ensures commerce_cart_items.variation_id exists.
 * TypeORM CartItem maps this column; Postgres step10 schema omitted it.
 */
export async function repairCartVariationSchema(): Promise<void> {
  if (isPostgresDbType()) {
    await repairPostgres();
    return;
  }
  await repairMysql();
}

async function repairMysql(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });
    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, 'commerce_cart_items'],
    );
    if (!tables.length) return;

    const [cols] = await connection.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [database, 'commerce_cart_items', 'variation_id'],
    );
    if (cols.length) return;

    await connection.query(
      'ALTER TABLE `commerce_cart_items` ADD COLUMN `variation_id` varchar(36) NULL AFTER `vendor_id`',
    );
    console.log('[commerce-service] Added commerce_cart_items.variation_id');
  } catch (err) {
    console.warn(
      '[commerce-service] cart variation_id schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

async function repairPostgres(): Promise<void> {
  const PgClient = require('pg').Client;
  const client = new PgClient({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'p4u_admin_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const tableExists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
      ['commerce_cart_items'],
    );
    if (!tableExists.rowCount) return;

    const columnExists = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
      ['commerce_cart_items', 'variation_id'],
    );
    if (columnExists.rowCount) return;

    await client.query(
      `ALTER TABLE commerce_cart_items ADD COLUMN variation_id varchar(36) NULL`,
    );
    console.log('[commerce-service] Added commerce_cart_items.variation_id');
  } catch (err) {
    console.warn(
      '[commerce-service] postgres cart variation_id schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
