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

const VENDOR_SIGNUP_REQUESTS_MYSQL_DDL = `
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

const VENDOR_SIGNUP_REQUESTS_PG_DDL = `
CREATE TABLE IF NOT EXISTS vendor_signup_requests (
  id varchar(36) NOT NULL,
  request_type varchar(64) NOT NULL DEFAULT 'signup',
  payload json NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_vendor_signup_requests_status ON vendor_signup_requests (status);
`;

interface ColumnSpec {
  name: string;
  mysqlDdl: string;
  pgDdl: string;
}

const CUSTOMER_PROFILE_COLUMNS: ColumnSpec[] = [
  {
    name: 'state',
    mysqlDdl: '`state` VARCHAR(128) NULL',
    pgDdl: 'state VARCHAR(128) NULL',
  },
  {
    name: 'district',
    mysqlDdl: '`district` VARCHAR(128) NULL',
    pgDdl: 'district VARCHAR(128) NULL',
  },
  {
    name: 'area_locality',
    mysqlDdl: '`area_locality` VARCHAR(255) NULL',
    pgDdl: 'area_locality VARCHAR(255) NULL',
  },
  {
    name: 'pincode',
    mysqlDdl: '`pincode` VARCHAR(16) NULL',
    pgDdl: 'pincode VARCHAR(16) NULL',
  },
  {
    name: 'latitude',
    mysqlDdl: '`latitude` DECIMAL(10,7) NULL',
    pgDdl: 'latitude DECIMAL(10,7) NULL',
  },
  {
    name: 'longitude',
    mysqlDdl: '`longitude` DECIMAL(10,7) NULL',
    pgDdl: 'longitude DECIMAL(10,7) NULL',
  },
  {
    name: 'referral_code',
    mysqlDdl: '`referral_code` VARCHAR(64) NULL',
    pgDdl: 'referral_code VARCHAR(64) NULL',
  },
];

/** Columns auth's CatalogVendor entity reads/writes on shared catalog_vendors. */
const CATALOG_VENDOR_COLUMNS: ColumnSpec[] = [
  {
    name: 'business_type',
    mysqlDdl: '`business_type` VARCHAR(64) NULL',
    pgDdl: 'business_type VARCHAR(64) NULL',
  },
  {
    name: 'vendor_kind',
    mysqlDdl: "`vendor_kind` VARCHAR(16) NOT NULL DEFAULT 'product'",
    pgDdl: "vendor_kind VARCHAR(16) NOT NULL DEFAULT 'product'",
  },
  {
    name: 'vendor_type',
    mysqlDdl: "`vendor_type` VARCHAR(16) NOT NULL DEFAULT 'PRODUCT'",
    pgDdl: "vendor_type VARCHAR(16) NOT NULL DEFAULT 'PRODUCT'",
  },
];

function isPostgres(): boolean {
  return (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres';
}

async function ensureTableColumns(
  queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
  dbName: unknown,
  table: string,
  columns: ColumnSpec[],
  logPrefix: string,
  postgres: boolean,
): Promise<void> {
  if (postgres) {
    const tableExists = await queryRunner.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if (!Array.isArray(tableExists) || tableExists.length === 0) return;

    for (const col of columns) {
      const present = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, col.name],
      );
      if (Array.isArray(present) && present.length > 0) continue;
      try {
        await queryRunner.query(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${col.pgDdl}`,
        );
        console.log(`[auth-service] Added ${logPrefix}.${col.name}`);
      } catch (alterErr: any) {
        console.warn(
          `[auth-service] Could not add ${logPrefix}.${col.name}:`,
          alterErr?.message ?? alterErr,
        );
      }
    }
    return;
  }

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
      await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN ${col.mysqlDdl}`);
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
  const postgres = isPostgres();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await queryRunner.connect();

    try {
      if (postgres) {
        await queryRunner.query(VENDOR_SIGNUP_REQUESTS_PG_DDL);
      } else {
        await queryRunner.query(VENDOR_SIGNUP_REQUESTS_MYSQL_DDL);
      }
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
        postgres,
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
        postgres,
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
