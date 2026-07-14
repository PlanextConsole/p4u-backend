import { createConnection, RowDataPacket } from 'mysql2/promise';
import { isPostgresDbType } from './database';

/** Dropshipping tables + platform flag (vendor portal). */
export async function repairVendorDropshippingSchema(): Promise<void> {
  if (isPostgresDbType()) {
    // Tables are created by postgres step8; skip MySQL DDL on PG.
    console.log('[vendor-service] Dropshipping schema assumed present on postgres (step8)');
    return;
  }
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const ensure = async (table: string, sql: string) => {
      const [rows] = await connection!.query<RowDataPacket[]>(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [database, table],
      );
      if (!rows.length) {
        await connection!.query(sql);
        console.log(`[vendor-service] Created ${table}`);
      }
    };

    await ensure(
      'platform_settings',
      `CREATE TABLE platform_settings (
        id INT NOT NULL PRIMARY KEY,
        dropshipping_enabled TINYINT(1) NOT NULL DEFAULT 1,
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await connection.query(`INSERT IGNORE INTO platform_settings (id, dropshipping_enabled) VALUES (1, 1)`);

    await ensure(
      'dropshipping_suppliers',
      `CREATE TABLE dropshipping_suppliers (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NULL,
        contact_phone VARCHAR(64) NULL,
        country_code VARCHAR(8) NULL,
        currency_code VARCHAR(8) NOT NULL DEFAULT 'INR',
        website VARCHAR(512) NULL,
        default_lead_time_days INT NOT NULL DEFAULT 7,
        default_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        notes TEXT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_ds_suppliers_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

    await ensure(
      'vendor_dropshipping_settings',
      `CREATE TABLE vendor_dropshipping_settings (
        vendor_id VARCHAR(36) NOT NULL PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        default_supplier_id VARCHAR(36) NULL,
        auto_forward_orders TINYINT(1) NOT NULL DEFAULT 0,
        default_margin_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
        notify_on_status_change TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_vds_supplier (default_supplier_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

    await ensure(
      'dropshipping_orders',
      `CREATE TABLE dropshipping_orders (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL,
        vendor_id VARCHAR(36) NOT NULL,
        supplier_id VARCHAR(36) NOT NULL,
        supplier_order_ref VARCHAR(128) NULL,
        items JSON NULL,
        cost_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        margin_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency_code VARCHAR(8) NOT NULL DEFAULT 'INR',
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        tracking_number VARCHAR(128) NULL,
        tracking_url VARCHAR(512) NULL,
        carrier VARCHAR(128) NULL,
        forwarded_at DATETIME(6) NULL,
        expected_delivery_date DATE NULL,
        delivered_at DATETIME(6) NULL,
        notes TEXT NULL,
        error_message TEXT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_ds_orders_vendor (vendor_id, created_at),
        INDEX idx_ds_orders_order (order_id),
        INDEX idx_ds_orders_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  } catch (err) {
    console.warn('[vendor-service] dropshipping schema repair skipped:', err instanceof Error ? err.message : err);
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
