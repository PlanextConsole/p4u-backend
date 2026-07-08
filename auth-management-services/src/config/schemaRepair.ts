import { AppDataSource } from './database';

/**
 * Defensive schema repair: creates auth-owned tables when they are missing on
 * fresh installs (where DB_SYNCHRONIZE is intentionally off to avoid cross-
 * service DDL drift), and tops up `customer_profiles` with the columns the
 * phone-OTP signup flow needs.
 *
 * Currently ensures:
 *   - vendor_signup_requests (used by VENDOR signup flow in vendor-web)
 *   - customer_profiles.{state, district, area_locality, pincode, latitude,
 *     longitude, referral_code} (used by phone-OTP customer signup)
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

export async function repairAuthSchema(): Promise<void> {
  if (!AppDataSource.isInitialized) return;
  if ((process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres') {
    console.log('[auth-service] schema repair skipped on postgres');
    return;
  }
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await queryRunner.connect();
    await queryRunner.query(VENDOR_SIGNUP_REQUESTS_DDL);
    console.log('[auth-service] Ensured vendor_signup_requests table exists');
  } catch (e: any) {
    console.warn(
      '[auth-service] vendor_signup_requests schema repair skipped:',
      e?.message ?? e,
    );
  }

  try {
    const dbName = AppDataSource.options.database;
    const tableExists = await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles'`,
      [dbName],
    );
    if (Array.isArray(tableExists) && tableExists.length > 0) {
      for (const col of CUSTOMER_PROFILE_COLUMNS) {
        const present = await queryRunner.query(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles' AND COLUMN_NAME = ?`,
          [dbName, col.name],
        );
        if (Array.isArray(present) && present.length > 0) continue;
        try {
          await queryRunner.query(`ALTER TABLE \`customer_profiles\` ADD COLUMN ${col.ddl}`);
          console.log(`[auth-service] Added customer_profiles.${col.name}`);
        } catch (alterErr: any) {
          console.warn(
            `[auth-service] Could not add customer_profiles.${col.name}:`,
            alterErr?.message ?? alterErr,
          );
        }
      }
    }
  } catch (e: any) {
    console.warn(
      '[auth-service] customer_profiles column repair skipped:',
      e?.message ?? e,
    );
  } finally {
    await queryRunner.release();
  }
}
