import { createConnection, RowDataPacket } from 'mysql2/promise';

/** Vendor-scoped media library tables (folders + assets). */
export async function repairVendorMediaSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [folders] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, 'vendor_media_folders'],
    );
    if (!folders.length) {
      await connection.query(`
        CREATE TABLE vendor_media_folders (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          vendor_id VARCHAR(36) NOT NULL,
          name VARCHAR(160) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          INDEX idx_vendor_media_folders_vendor (vendor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('[vendor-service] Created vendor_media_folders');
    }

    const [assets] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, 'vendor_media_assets'],
    );
    if (!assets.length) {
      await connection.query(`
        CREATE TABLE vendor_media_assets (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          vendor_id VARCHAR(36) NOT NULL,
          folder_id VARCHAR(36) NULL,
          original_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(128) NOT NULL,
          size_bytes BIGINT NOT NULL DEFAULT 0,
          url VARCHAR(512) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          INDEX idx_vendor_media_assets_vendor (vendor_id),
          INDEX idx_vendor_media_assets_folder (folder_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('[vendor-service] Created vendor_media_assets');
    }
  } catch (err) {
    console.warn('[vendor-service] vendor media schema repair skipped:', err instanceof Error ? err.message : err);
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
