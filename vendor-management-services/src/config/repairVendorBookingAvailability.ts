import { createConnection, RowDataPacket } from 'mysql2/promise';
import { AppDataSource, isPostgresDbType } from './database';

/** `catalog_vendors.booking_availability_json` — service vendor booking schedule (shared DB). */
export async function repairVendorBookingAvailabilitySchema(): Promise<void> {
  const table = 'catalog_vendors';
  const column = 'booking_availability_json';
  const isPostgres = isPostgresDbType();

  if (isPostgres) {
    if (!AppDataSource.isInitialized) return;
    const queryRunner = AppDataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.query(
        `ALTER TABLE catalog_vendors ADD COLUMN IF NOT EXISTS booking_availability_json jsonb NULL`,
      );
      console.log(`[vendor-service] Ensured catalog_vendors.booking_availability_json (postgres)`);
    } catch (err) {
      console.warn(
        '[vendor-service] booking availability column repair skipped:',
        err instanceof Error ? err.message : err,
      );
    } finally {
      await queryRunner.release();
    }
    return;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  const ddl = '`booking_availability_json` JSON NULL';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });
    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, table],
    );
    if (!tables.length) return;

    const [cols] = await connection.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [database, table, column],
    );
    if (cols.length) return;

    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    console.log(`[vendor-service] Added ${table}.${column}`);
  } catch (err) {
    console.warn(
      '[vendor-service] booking availability column repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
