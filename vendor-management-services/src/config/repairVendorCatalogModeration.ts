import { createConnection, RowDataPacket } from 'mysql2/promise';

const VENDOR_CATALOG_MODERATION_DDLS: { table: string; column: string; ddl: string }[] = [
  {
    table: 'catalog_products',
    column: 'moderation_status',
    ddl: "`moderation_status` VARCHAR(32) NOT NULL DEFAULT 'approved'",
  },
  {
    table: 'catalog_vendor_services',
    column: 'moderation_status',
    ddl: "`moderation_status` VARCHAR(32) NOT NULL DEFAULT 'approved'",
  },
];

/** Same columns as admin `repairVendorCatalogModerationSchema` — vendor service shares DB. */
export async function repairVendorCatalogModerationSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    for (const { table, column, ddl } of VENDOR_CATALOG_MODERATION_DDLS) {
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

        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
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
