import { AppDataSource } from './database';

/**
 * Defensive schema repair: creates auth-owned tables when they are missing on
 * fresh installs (where DB_SYNCHRONIZE is intentionally off to avoid cross-
 * service DDL drift), and tops up shared tables with columns the phone-OTP /
 * vendor login flows need.
 *
 * Currently ensures:
 *   - vendor_signup_requests (used by VENDOR signup flow in vendor-web)
 *   - customer_profiles.{state, district, area_locality, pincode, latitude,
 *     longitude, referral_code} (used by phone-OTP customer signup)
 *   - catalog_vendors.business_type (mapped by CatalogVendor; required on
 *     vendor OTP login SELECT/UPDATE)
 */

const VENDOR_SIGNUP_REQUESTS_DDL = `
CREATE TABLE IF NOT EXISTS vendor_signup_requests (
  \`id\` varchar(36) NOT NULL,
  \`request_type\` varchar(64) NOT NULL DEFAULT 'signup',
  \`payload\` json NOT NULL,
  \`status\` varchar(32) NOT NULL DEFAULT 'pending',
  \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (\`id\`),
  KEY \`idx_vendor_signup_requests_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

interface ColumnSpec {
  name: string;
  ddl: string;
}

const CUSTOMER_PROFILE_COLUMNS: ColumnSpec[] = [
  { name: 'state', ddl: '`state` VARCHAR(128) NULL' },
  { name: 'district', ddl: '`district` VARCHAR(128) NULL' },
  { name: 'area_locality', ddl: '`area_locality` VARCHAR(255) NULL' },
  { name: 'pincode', ddl: '`pincode` VARCHAR(16) NULL' },
  { name: 'latitude', ddl: '`latitude` DECIMAL(10,7) NULL' },
  { name: 'longitude', ddl: '`longitude` DECIMAL(10,7) NULL' },
  { name: 'referral_code', ddl: '`referral_code` VARCHAR(64) NULL' },
];

/** Columns auth's CatalogVendor entity reads/writes on shared catalog_vendors. */
const CATALOG_VENDOR_COLUMNS: ColumnSpec[] = [
  { name: 'business_type', ddl: '`business_type` VARCHAR(64) NULL' },
  { name: 'vendor_kind', ddl: "`vendor_kind` VARCHAR(16) NOT NULL DEFAULT 'product'" },
  { name: 'vendor_type', ddl: "`vendor_type` VARCHAR(16) NOT NULL DEFAULT 'PRODUCT'" },
];

async function ensureTableColumns(
  queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
  dbName: unknown,
  table: string,
  columns: ColumnSpec[],
  logPrefix: string,
): Promise<void> {
  const tableExists = await queryRunner.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, table],
  );
  if (!Array.isArray(tableExists) || tableExists.length === 0) return;

  for (const col of columns) {
    const present = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, table, col.name],
    );
    if (Array.isArray(present) && present.length > 0) continue;
    try {
      await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN ${col.ddl}`);
      console.log(`[auth-service] Added ${logPrefix}.${col.name}`);
    } catch (alterErr: any) {
      console.warn(
        `[auth-service] Could not add ${logPrefix}.${col.name}:`,
        alterErr?.message ?? alterErr,
      );
    }
  }
}

export async function repairAuthSchema(): Promise<void> {
  if (!AppDataSource.isInitialized) return;
  if ((process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres') {
    console.log('[auth-service] schema repair skipped on postgres');
    return;
  }
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await queryRunner.connect();

    try {
      await queryRunner.query(VENDOR_SIGNUP_REQUESTS_DDL);
      console.log('[auth-service] Ensured vendor_signup_requests table exists');
    } catch (e: any) {
      console.warn(
        '[auth-service] vendor_signup_requests schema repair skipped:',
        e?.message ?? e,
      );
    }

    const dbName = AppDataSource.options.database;

    try {
      await ensureTableColumns(
        queryRunner,
        dbName,
        'customer_profiles',
        CUSTOMER_PROFILE_COLUMNS,
        'customer_profiles',
      );
    } catch (e: any) {
      console.warn(
        '[auth-service] customer_profiles column repair skipped:',
        e?.message ?? e,
      );
    }

    try {
      await ensureTableColumns(
        queryRunner,
        dbName,
        'catalog_vendors',
        CATALOG_VENDOR_COLUMNS,
        'catalog_vendors',
      );
    } catch (e: any) {
      console.warn(
        '[auth-service] catalog_vendors column repair skipped:',
        e?.message ?? e,
      );
    }
  } finally {
    await queryRunner.release();
  }
}
