import { createConnection, RowDataPacket } from 'mysql2/promise';
import { isPostgresDbType } from './database';

const PgClient = require('pg').Client;

const VENDOR_CATALOG_MODERATION_COLUMNS = [
  { table: 'catalog_products', column: 'moderation_status' },
  { table: 'catalog_vendor_services', column: 'moderation_status' },
];

/** Same columns as admin `repairVendorCatalogModerationSchema` - vendor service shares DB. */
export async function repairVendorCatalogModerationSchema(): Promise<void> {
  if (isPostgresDbType()) {
    await repairPostgresVendorCatalogModerationSchema();
    return;
  }
  await repairMysqlVendorCatalogModerationSchema();
}

async function repairMysqlVendorCatalogModerationSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    for (const { table, column } of VENDOR_CATALOG_MODERATION_COLUMNS) {
      try {
        const [tables] = await connection.query<RowDataPacket[]>(
          `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [database, table],
        );
        if (!tables.length) continue;

        const [cols] = await connection.query<RowDataPacket[]>(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [database, table, column],
        );
        if (cols.length) continue;

        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` VARCHAR(32) NOT NULL DEFAULT 'approved'`);
        console.log(`[vendor-service] Added moderation column ${table}.${column}`);
      } catch (err) {
        console.warn(
          `[vendor-service] moderation column ${table}.${column} skipped:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    console.warn(
      '[vendor-service] moderation schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

async function repairPostgresVendorCatalogModerationSchema(): Promise<void> {
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
    for (const { table, column } of VENDOR_CATALOG_MODERATION_COLUMNS) {
      try {
        const tableExists = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
          [table],
        );
        if (!tableExists.rowCount) continue;

        const columnExists = await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
          [table, column],
        );
        if (columnExists.rowCount) continue;

        await client.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" varchar(32) NOT NULL DEFAULT 'approved'`);
        console.log(`[vendor-service] Added moderation column ${table}.${column}`);
      } catch (err) {
        console.warn(
          `[vendor-service] moderation column ${table}.${column} skipped:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    console.warn(
      '[vendor-service] postgres moderation schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}


