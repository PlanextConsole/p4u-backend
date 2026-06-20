import { createConnection, RowDataPacket } from 'mysql2/promise';

/**
 * Legacy `customer_profiles` used `mobile`; entity `phone` maps to column `phone`.
 */
async function normalizeCustomerProfilesPhoneColumn(
  connection: Awaited<ReturnType<typeof createConnection>>,
  schema: string
): Promise<void> {
  try {
    const [cols] = await connection.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles'
         AND COLUMN_NAME IN ('phone', 'mobile')`,
      [schema]
    );
    const has = new Set(cols.map((r) => String(r.COLUMN_NAME)));
    if (has.has('phone')) return;
    if (has.has('mobile')) {
      await connection.query(
        'ALTER TABLE `customer_profiles` CHANGE COLUMN `mobile` `phone` VARCHAR(32) NULL'
      );
      console.log('[profile-service] Renamed customer_profiles.mobile -> phone');
      return;
    }
    await connection.query('ALTER TABLE `customer_profiles` ADD COLUMN `phone` VARCHAR(32) NULL');
    console.log('[profile-service] Added missing column customer_profiles.phone');
  } catch (err) {
    console.warn(
      '[profile-service] Could not normalize customer_profiles.phone:',
      err instanceof Error ? err.message : err
    );
  }
}

const CUSTOMER_PROFILES_COLUMNS: { column: string; ddl: string; required: boolean }[] = [
  // Legacy schemas used `email_address`; entity + indexes expect `email`. Must exist before synchronize creates IDX on email.
  { column: 'email', ddl: '`email` VARCHAR(255) NULL', required: true },
  { column: 'status', ddl: '`status` VARCHAR(32) NOT NULL DEFAULT \'active\'', required: true },
  { column: 'occupation_id', ddl: '`occupation_id` VARCHAR(36) NULL', required: false },
  { column: 'keycloak_user_id', ddl: '`keycloak_user_id` VARCHAR(128) NULL', required: false },
  { column: 'metadata', ddl: '`metadata` JSON NULL', required: false },
  {
    column: 'created_at',
    ddl: '`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
    required: true,
  },
  {
    column: 'updated_at',
    ddl: '`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
    required: true,
  },
];

/**
 * Existing deployments may have `customer_profiles` without newer columns.
 * TypeORM synchronize can try to CREATE INDEX before columns exist — add columns first.
 * Uses the connection's active catalog (DATABASE()) so TABLE_SCHEMA matches MySQL.
 */
export async function ensureCustomerProfilesHasStatusBeforeSync(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = String(process.env.DB_NAME || 'p4u_admin_db').trim() || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [dbRow] = await connection.query<RowDataPacket[]>('SELECT DATABASE() AS db');
    const schema = String(dbRow[0]?.db || database).trim() || database;

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles'`,
      [schema]
    );
    if (!tables.length) {
      console.log('[profile-service] customer_profiles not found; TypeORM synchronize will create it.');
      return;
    }

    await normalizeCustomerProfilesPhoneColumn(connection, schema);

    for (const { column, ddl, required } of CUSTOMER_PROFILES_COLUMNS) {
      try {
        const [cols] = await connection.query<RowDataPacket[]>(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles' AND COLUMN_NAME = ?`,
          [schema, column]
        );
        if (cols.length) continue;

        await connection.query(`ALTER TABLE \`customer_profiles\` ADD COLUMN ${ddl}`);
        console.log(`[profile-service] Added missing column customer_profiles.${column}`);

        if (column === 'email') {
          try {
            const [legacy] = await connection.query<RowDataPacket[]>(
              `SELECT COLUMN_NAME FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles' AND COLUMN_NAME = 'email_address'`,
              [schema]
            );
            if (legacy.length) {
              await connection.query(
                `UPDATE customer_profiles
                 SET email = NULLIF(TRIM(COALESCE(email, email_address)), '')
                 WHERE email IS NULL OR TRIM(email) = ''`
              );
              console.log('[profile-service] Backfilled customer_profiles.email from email_address');
            }
          } catch (backfillErr) {
            console.warn(
              '[profile-service] Could not backfill customer_profiles.email:',
              backfillErr instanceof Error ? backfillErr.message : backfillErr
            );
          }
        }
      } catch (colErr) {
        const msg = colErr instanceof Error ? colErr.message : String(colErr);
        if (required) {
          console.error(`[profile-service] Failed to add required column customer_profiles.${column}:`, msg);
          throw new Error(
            `Profile service cannot start: failed adding customer_profiles.${column} (${msg}). ` +
              `Check DB user permissions and that TABLE_SCHEMA "${schema}" is correct.`
          );
        }
        console.warn(`[profile-service] Could not ensure customer_profiles.${column}:`, msg);
      }
    }

    const [statusCheck] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles' AND COLUMN_NAME = 'status'`,
      [schema]
    );
    if (Number(statusCheck[0]?.c ?? 0) === 0) {
      throw new Error(
        `[profile-service] customer_profiles exists in "${schema}" but column "status" is still missing after repair. ` +
          'Fix the table manually or correct DB_NAME / connection catalog.'
      );
    }

    const [emailCheck] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles' AND COLUMN_NAME = 'email'`,
      [schema]
    );
    if (Number(emailCheck[0]?.c ?? 0) === 0) {
      throw new Error(
        `[profile-service] customer_profiles exists in "${schema}" but column "email" is still missing after repair. ` +
          'Legacy DB may need manual migration from email_address, or fix DB permissions.'
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('[profile-service]')) throw err;
    if (err instanceof Error && err.message.startsWith('Profile service cannot start')) throw err;
    console.warn(
      '[profile-service] Pre-sync schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
