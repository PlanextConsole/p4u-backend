import { createConnection, RowDataPacket } from 'mysql2/promise';

/**
 * Legacy `customer_profiles` used `mobile`; TypeORM `Customer.phone` maps to column `phone`.
 * Renames `mobile` -> `phone`, or adds `phone` when neither exists.
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
      console.log('[admin-service] Renamed customer_profiles.mobile -> phone');
      return;
    }
    await connection.query('ALTER TABLE `customer_profiles` ADD COLUMN `phone` VARCHAR(32) NULL');
    console.log('[admin-service] Added missing column customer_profiles.phone');
  } catch (err) {
    console.warn(
      '[admin-service] Could not normalize customer_profiles.phone:',
      err instanceof Error ? err.message : err
    );
  }
}

const CUSTOMER_PROFILES_COLUMNS: { column: string; ddl: string }[] = [
  // Some legacy schemas used email_address; current entity expects email.
  { column: 'email', ddl: '`email` VARCHAR(255) NULL' },
  { column: 'status', ddl: '`status` VARCHAR(32) NOT NULL DEFAULT \'active\'' },
  { column: 'occupation_id', ddl: '`occupation_id` VARCHAR(36) NULL' },
  { column: 'keycloak_user_id', ddl: '`keycloak_user_id` VARCHAR(128) NULL' },
  { column: 'metadata', ddl: '`metadata` JSON NULL' },
  // Required by Customer entity mapping (@CreateDateColumn/@UpdateDateColumn).
  { column: 'created_at', ddl: '`created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)' },
  { column: 'updated_at', ddl: '`updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)' },
];

const CATALOG_VENDORS_COLUMNS: { column: string; ddl: string }[] = [
  // Required by Vendor entity mapping and vendor-type filtering.
  { column: 'vendor_kind', ddl: '`vendor_kind` VARCHAR(16) NOT NULL DEFAULT \'product\'' },
  { column: 'vendor_type', ddl: '`vendor_type` VARCHAR(16) NOT NULL DEFAULT \'PRODUCT\'' },
];

/**
 * Legacy `customer_profiles` tables may omit columns added after the ORM entity.
 * Adds any missing columns so TypeORM selects/filters do not fail at runtime.
 */
export async function repairCustomerProfilesSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles'`,
      [database]
    );
    if (!tables.length) return;

    await normalizeCustomerProfilesPhoneColumn(connection, database);

    for (const { column, ddl } of CUSTOMER_PROFILES_COLUMNS) {
      try {
        const [cols] = await connection.query<RowDataPacket[]>(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles' AND COLUMN_NAME = ?`,
          [database, column]
        );
        if (cols.length) continue;

        await connection.query(`ALTER TABLE \`customer_profiles\` ADD COLUMN ${ddl}`);
        console.log(`[admin-service] Added missing column customer_profiles.${column}`);

        // Backfill renamed legacy email field when present.
        if (column === 'email') {
          try {
            const [legacy] = await connection.query<RowDataPacket[]>(
              `SELECT COLUMN_NAME FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_profiles' AND COLUMN_NAME = 'email_address'`,
              [database]
            );
            if (legacy.length) {
              await connection.query(
                `UPDATE customer_profiles
                 SET email = NULLIF(TRIM(COALESCE(email, email_address)), '')
                 WHERE email IS NULL OR TRIM(email) = ''`
              );
              console.log('[admin-service] Backfilled customer_profiles.email from email_address');
            }
          } catch (backfillErr) {
            console.warn(
              '[admin-service] Could not backfill customer_profiles.email:',
              backfillErr instanceof Error ? backfillErr.message : backfillErr
            );
          }
        }
      } catch (colErr) {
        console.warn(
          `[admin-service] Could not ensure customer_profiles.${column}:`,
          colErr instanceof Error ? colErr.message : colErr
        );
      }
    }
  } catch (err) {
    console.warn(
      '[admin-service] customer_profiles schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

/**
 * Some DBs still miss `catalog_vendors.vendor_kind` while code already filters/selects it.
 * Adds the column defensively so vendor list/dashboard queries do not fail at runtime.
 */
export async function repairCatalogVendorsSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'catalog_vendors'`,
      [database]
    );
    if (!tables.length) return;

    for (const { column, ddl } of CATALOG_VENDORS_COLUMNS) {
      try {
        const [cols] = await connection.query<RowDataPacket[]>(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'catalog_vendors' AND COLUMN_NAME = ?`,
          [database, column]
        );
        if (cols.length) continue;

        await connection.query(`ALTER TABLE \`catalog_vendors\` ADD COLUMN ${ddl}`);
        console.log(`[admin-service] Added missing column catalog_vendors.${column}`);
      } catch (colErr) {
        console.warn(
          `[admin-service] Could not ensure catalog_vendors.${column}:`,
          colErr instanceof Error ? colErr.message : colErr
        );
      }
    }

    try {
      // Keep vendor kind/type aligned without downgrading legacy SERVICE vendors to PRODUCT.
      await connection.query(
        `UPDATE catalog_vendors
         SET vendor_kind = 'service'
         WHERE UPPER(TRIM(COALESCE(vendor_type, ''))) = 'SERVICE'
           AND LOWER(TRIM(COALESCE(vendor_kind, ''))) <> 'service'`
      );
      await connection.query(
        `UPDATE catalog_vendors
         SET vendor_kind = 'product'
         WHERE UPPER(TRIM(COALESCE(vendor_type, ''))) = 'PRODUCT'
           AND LOWER(TRIM(COALESCE(vendor_kind, ''))) NOT IN ('product', 'service')`
      );
      await connection.query(
        `UPDATE catalog_vendors
         SET vendor_type = 'SERVICE'
         WHERE LOWER(TRIM(COALESCE(vendor_kind, ''))) = 'service'
           AND UPPER(TRIM(COALESCE(vendor_type, ''))) <> 'SERVICE'`
      );
      await connection.query(
        `UPDATE catalog_vendors
         SET vendor_type = 'PRODUCT'
         WHERE LOWER(TRIM(COALESCE(vendor_kind, ''))) = 'product'
           AND UPPER(TRIM(COALESCE(vendor_type, ''))) NOT IN ('PRODUCT', 'SERVICE')`
      );
    } catch (syncErr) {
      console.warn(
        '[admin-service] catalog_vendors vendor_type sync skipped:',
        syncErr instanceof Error ? syncErr.message : syncErr
      );
    }
  } catch (err) {
    console.warn(
      '[admin-service] catalog_vendors schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

/** DDL aligned with `migrations/2026-04-29-create-vendor-plans.sql` and `VendorPlan` entity. */
const VENDOR_PLANS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS vendor_plans (
  id char(36) NOT NULL,
  plan_name varchar(120) NOT NULL,
  description text NULL,
  plan_type varchar(16) NOT NULL,
  tier int NOT NULL DEFAULT 1,
  price decimal(12,2) NOT NULL DEFAULT 0,
  validity_days int NOT NULL DEFAULT 30,
  visibility_type varchar(24) NOT NULL DEFAULT 'radius',
  radius_km decimal(8,2) NULL,
  commission_percent decimal(5,2) NOT NULL DEFAULT 0,
  max_user_redemption_percent decimal(5,2) NOT NULL DEFAULT 0,
  payment_mode varchar(16) NOT NULL DEFAULT 'both',
  promo_banner_ads tinyint(1) NOT NULL DEFAULT 0,
  promo_video_ads tinyint(1) NOT NULL DEFAULT 0,
  promo_priority_listing tinyint(1) NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  metadata json NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_vendor_plans_type_tier (plan_type, tier),
  KEY idx_vendor_plans_active (is_active),
  KEY idx_vendor_plans_name (plan_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/**
 * Fresh installs often omit `vendor_plans` until someone runs npm run migrate:vendor-plans.
 * Creates the table if missing so Vendor Plans admin UI stops failing with SQL errors.
 */
export async function repairVendorPlansSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vendor_plans'`,
      [database]
    );
    if (tables.length) return;

    await connection.query(VENDOR_PLANS_CREATE_SQL);
    console.log('[admin-service] Created missing table vendor_plans');
  } catch (err) {
    console.warn(
      '[admin-service] vendor_plans schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

const PUSH_NOTIFICATION_SENDS_SQL = `
CREATE TABLE IF NOT EXISTS admin_push_notification_sends (
  id char(36) NOT NULL,
  target_audience varchar(64) NOT NULL,
  title varchar(255) NOT NULL,
  body text NOT NULL,
  deep_link varchar(512) NULL,
  status varchar(24) NOT NULL DEFAULT 'sent',
  provider_detail text NULL,
  actor_sub varchar(255) NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_push_sends_created (created_at),
  KEY idx_push_sends_audience (target_audience)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const MEDIA_LIBRARY_FOLDERS_SQL = `
CREATE TABLE IF NOT EXISTS media_library_folders (
  id char(36) NOT NULL,
  name varchar(160) NOT NULL,
  slug varchar(180) NOT NULL,
  kind varchar(24) NOT NULL DEFAULT 'general',
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_media_library_folders_slug (slug),
  KEY idx_media_library_folders_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const MEDIA_LIBRARY_ASSETS_SQL = `
CREATE TABLE IF NOT EXISTS media_library_assets (
  id char(36) NOT NULL,
  folder_id char(36) NOT NULL,
  original_name varchar(512) NOT NULL,
  file_url text NOT NULL,
  relative_path varchar(512) NOT NULL,
  mime varchar(160) NOT NULL,
  size_bytes bigint unsigned NOT NULL,
  storage_kind varchar(16) NOT NULL DEFAULT 'local',
  b2_key varchar(1024) NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_media_library_assets_folder (folder_id),
  KEY idx_media_library_assets_storage (storage_kind),
  CONSTRAINT fk_media_library_assets_folder FOREIGN KEY (folder_id) REFERENCES media_library_folders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const MEDIA_LIBRARY_SEED_SQL = `
INSERT INTO media_library_folders (id, name, slug, kind, created_at, updated_at) VALUES
(UUID(), 'Banners', 'banners', 'general', NOW(6), NOW(6)),
(UUID(), 'General', 'general', 'general', NOW(6), NOW(6)),
(UUID(), 'Groceries', 'groceries', 'general', NOW(6), NOW(6)),
(UUID(), 'Homepage', 'homepage', 'general', NOW(6), NOW(6)),
(UUID(), 'Icons', 'icons', 'general', NOW(6), NOW(6)),
(UUID(), 'Onboarding', 'onboarding', 'general', NOW(6), NOW(6)),
(UUID(), 'Popup Banners', 'popup-banners', 'general', NOW(6), NOW(6)),
(UUID(), 'Product Images', 'product-images', 'general', NOW(6), NOW(6)),
(UUID(), 'Service Images', 'service-images', 'general', NOW(6), NOW(6)),
(UUID(), 'Category Icons', 'category-icons', 'general', NOW(6), NOW(6)),
(UUID(), 'Bio Enzyme', 'bio-enzyme', 'general', NOW(6), NOW(6)),
(UUID(), 'KYC Documents', 'kyc-documents', 'kyc', NOW(6), NOW(6))
`;

/**
 * Media Library folders + assets (FK). Seeds starter folders when the table is empty.
 */
export async function repairMediaLibrarySchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [folderTables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'media_library_folders'`,
      [database]
    );
    if (!folderTables.length) {
      await connection.query(MEDIA_LIBRARY_FOLDERS_SQL);
      console.log('[admin-service] Created missing table media_library_folders');
    }

    const [assetTables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'media_library_assets'`,
      [database]
    );
    if (!assetTables.length) {
      await connection.query(MEDIA_LIBRARY_ASSETS_SQL);
      console.log('[admin-service] Created missing table media_library_assets');
    }

    const [cntRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM media_library_folders`
    );
    const c = Number(cntRows[0]?.c ?? 0);
    if (c === 0) {
      await connection.query(MEDIA_LIBRARY_SEED_SQL);
      console.log('[admin-service] Seeded default media_library_folders');
    }
  } catch (err) {
    console.warn(
      '[admin-service] media_library schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

const ADMIN_BULK_UPLOAD_JOBS_SQL = `
CREATE TABLE IF NOT EXISTS admin_bulk_upload_jobs (
  id char(36) NOT NULL,
  upload_type varchar(24) NOT NULL,
  original_filename varchar(512) NOT NULL,
  stored_relative_path varchar(512) NOT NULL,
  status varchar(24) NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  result_detail json NULL,
  actor_sub varchar(255) NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_bulk_upload_type (upload_type),
  KEY idx_bulk_upload_status (status),
  KEY idx_bulk_upload_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const PRODUCT_ATTRIBUTE_DEFINITIONS_SQL = `
CREATE TABLE IF NOT EXISTS product_attribute_definitions (
  id char(36) NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(16) NOT NULL DEFAULT 'select',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  select_values json NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_attribute_name (name),
  KEY idx_product_attribute_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export async function repairProductAttributesSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_attribute_definitions'`,
      [database]
    );
    if (tables.length) return;

    await connection.query(PRODUCT_ATTRIBUTE_DEFINITIONS_SQL);
    console.log('[admin-service] Created missing table product_attribute_definitions');
  } catch (err) {
    console.warn(
      '[admin-service] product_attribute_definitions schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

export async function repairBulkUploadJobsSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_bulk_upload_jobs'`,
      [database]
    );
    if (tables.length) return;

    await connection.query(ADMIN_BULK_UPLOAD_JOBS_SQL);
    console.log('[admin-service] Created missing table admin_bulk_upload_jobs');
  } catch (err) {
    console.warn(
      '[admin-service] admin_bulk_upload_jobs schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

export async function repairPushNotificationSendsSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_push_notification_sends'`,
      [database]
    );
    if (tables.length) return;

    await connection.query(PUSH_NOTIFICATION_SENDS_SQL);
    console.log('[admin-service] Created missing table admin_push_notification_sends');
  } catch (err) {
    console.warn(
      '[admin-service] admin_push_notification_sends schema repair skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

/**
 * Seeds OCCUPATION_ADMIN_CREATE_ENABLED when missing so admins can toggle Add-occupation from Platform Variables.
 */
export async function repairOccupationAdminCreatePlatformVariableSeed(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  const valueJson = JSON.stringify({
    amount: 1,
    valueType: 'boolean',
    currencyType: 'None',
    description:
      'When 0, admins cannot add new occupations (Add button disabled). Edit, view, and delete remain available.',
  });

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_platform_variables'`,
      [database]
    );
    if (!tables.length) return;

    await connection.query(
      `INSERT INTO admin_platform_variables (id, \`key\`, value, category, is_active, created_at, updated_at)
       SELECT UUID(), 'OCCUPATION_ADMIN_CREATE_ENABLED', CAST(? AS JSON), 'Administrative', 1, NOW(6), NOW(6)
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM admin_platform_variables WHERE LOWER(TRIM(\`key\`)) = LOWER(TRIM('OCCUPATION_ADMIN_CREATE_ENABLED'))
       )`,
      [valueJson]
    );
  } catch (err) {
    console.warn(
      '[admin-service] OCCUPATION_ADMIN_CREATE_ENABLED seed skipped:',
      err instanceof Error ? err.message : err
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Pricing engine: idempotent column upgrades + seed defaults.
 * Used so an existing UAT/prod DB without the pricing-engine columns gets them
 * on the next admin restart, and a fresh DB ends up with sensible config rows.
 * ───────────────────────────────────────────────────────────────────────────── */

const PRICING_ENGINE_COLUMN_DDLS: { table: string; column: string; ddl: string }[] = [
  { table: 'catalog_vendors', column: 'vendor_plan_id', ddl: '`vendor_plan_id` VARCHAR(36) NULL' },
  { table: 'catalog_vendors', column: 'enrollment_cost', ddl: '`enrollment_cost` DECIMAL(12,2) NULL' },
  { table: 'catalog_vendors', column: 'coverage_radius_km', ddl: '`coverage_radius_km` DECIMAL(8,2) NULL' },
  { table: 'catalog_vendors', column: 'restriction', ddl: '`restriction` VARCHAR(32) NULL' },
  { table: 'catalog_vendors', column: 'self_delivery', ddl: '`self_delivery` TINYINT(1) NOT NULL DEFAULT 0' },
  { table: 'catalog_vendors', column: 'max_redemption_percent', ddl: '`max_redemption_percent` DECIMAL(5,2) NULL' },
  { table: 'product_categories', column: 'commission_override_percent', ddl: '`commission_override_percent` DECIMAL(5,2) NULL' },
  { table: 'catalog_categories', column: 'commission_override_percent', ddl: '`commission_override_percent` DECIMAL(5,2) NULL' },
  { table: 'catalog_products', column: 'commission_override_percent', ddl: '`commission_override_percent` DECIMAL(5,2) NULL' },
];

export async function repairPricingEngineSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    for (const { table, column, ddl } of PRICING_ENGINE_COLUMN_DDLS) {
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
        console.log(`[admin-service] Added pricing-engine column ${table}.${column}`);
      } catch (err) {
        console.warn(
          `[admin-service] pricing-engine column upgrade ${table}.${column} skipped:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    console.warn(
      '[admin-service] pricing-engine schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

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

/** Adds moderation columns for vendor-submitted products and service listings (admin approval). */
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
        console.log(`[admin-service] Added moderation column ${table}.${column}`);
      } catch (err) {
        console.warn(
          `[admin-service] moderation column upgrade ${table}.${column} skipped:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    console.warn(
      '[admin-service] vendor catalog moderation schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

const PRODUCT_VARIATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS \`catalog_product_variations\` (
  \`id\` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`product_id\` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`sku\` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`attributes\` json NOT NULL,
  \`sell_price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`discount_amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`final_price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`quantity\` int NOT NULL DEFAULT '0',
  \`thumbnail_url\` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`is_active\` tinyint NOT NULL DEFAULT '1',
  \`sort_order\` int NOT NULL DEFAULT '0',
  \`metadata\` json DEFAULT NULL,
  \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (\`id\`),
  KEY \`IDX_catalog_product_variations_product_id\` (\`product_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** Variable-product SKU rows + optional cart line variation reference. */
export async function repairProductVariationsSchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });
    await connection.query(PRODUCT_VARIATIONS_TABLE_DDL);
    console.log('[admin-service] Ensured catalog_product_variations table');

    const [cartTables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, 'commerce_cart_items'],
    );
    if (cartTables.length) {
      const [cols] = await connection.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [database, 'commerce_cart_items', 'variation_id'],
      );
      if (!cols.length) {
        await connection.query(
          'ALTER TABLE `commerce_cart_items` ADD COLUMN `variation_id` varchar(36) NULL AFTER `vendor_id`',
        );
        console.log('[admin-service] Added commerce_cart_items.variation_id');
      }
    }
  } catch (err) {
    console.warn(
      '[admin-service] product-variations schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

/** Adds `catalog_vendors.booking_availability_json` for service-vendor scheduling. */
export async function repairVendorBookingAvailabilitySchema(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  const table = 'catalog_vendors';
  const column = 'booking_availability_json';
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
    console.log(`[admin-service] Added ${table}.${column}`);
  } catch (err) {
    console.warn(
      '[admin-service] vendor booking availability column repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

const PLATFORM_VARIABLE_SEEDS: { key: string; valueAmount: number; category: string; description: string }[] = [
  { key: 'WELCOME_BONUS', valueAmount: 300, category: 'Loyalty', description: 'Points credited to a new customer on signup' },
  { key: 'REFERRAL_BONUS', valueAmount: 100, category: 'Loyalty', description: 'Points credited to a customer who joins via a referral code' },
  { key: 'VENDOR_REFERRAL_BONUS', valueAmount: 200, category: 'Loyalty', description: 'Points credited to the customer whose referral code was used' },
  { key: 'POST_SHARE_POINTS', valueAmount: 1, category: 'Loyalty', description: 'Points credited when a user shares a post' },
  { key: 'POST_LIKE_POINTS', valueAmount: 1, category: 'Loyalty', description: 'Points credited when a user likes a post' },
  { key: 'STORY_LIKE_POINTS', valueAmount: 1, category: 'Loyalty', description: 'Points credited when a user likes a story' },
  { key: 'PLATFORM_FEE', valueAmount: 10, category: 'Checkout', description: 'Flat platform fee added to every order' },
  { key: 'GST_ON_PLATFORM_FEE_PERCENT', valueAmount: 18, category: 'Checkout', description: 'GST percentage applied on the platform fee' },
  { key: 'MIN_CART_VALUE', valueAmount: 0, category: 'Checkout', description: 'Minimum cart value required to checkout' },
  { key: 'SURGE_COST', valueAmount: 0, category: 'Checkout', description: 'Surge fee added to orders (peak load / time-based)' },
  { key: 'DELIVERY_FEE', valueAmount: 0, category: 'Checkout', description: 'Default delivery fee added to orders' },
];

export async function seedPlatformVariableDefaults(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_platform_variables'`,
      [database],
    );
    if (!tables.length) return;

    let seeded = 0;
    for (const seed of PLATFORM_VARIABLE_SEEDS) {
      const valueJson = JSON.stringify({
        amount: seed.valueAmount,
        valueType: 'FLAT',
        currencyType: seed.key.includes('PERCENT')
          ? 'None'
          : (seed.key.endsWith('_POINTS') || seed.key.endsWith('_BONUS') ? 'Points' : 'Ruppees'),
        description: seed.description,
      });
      try {
        const [exists] = await connection.query<RowDataPacket[]>(
          `SELECT 1 FROM admin_platform_variables WHERE LOWER(TRIM(\`key\`)) = LOWER(TRIM(?)) LIMIT 1`,
          [seed.key],
        );
        if (exists.length) continue;
        await connection.query(
          `INSERT INTO admin_platform_variables (id, \`key\`, value, category, is_active, created_at, updated_at)
           VALUES (UUID(), ?, CAST(? AS JSON), ?, 1, NOW(6), NOW(6))`,
          [seed.key, valueJson, seed.category],
        );
        seeded += 1;
      } catch (err) {
        console.warn(
          `[admin-service] platform-variable seed ${seed.key} skipped:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (seeded > 0) console.log(`[admin-service] Seeded ${seeded} platform-variable defaults`);
  } catch (err) {
    console.warn(
      '[admin-service] platform-variable seed skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

const VENDOR_PLAN_SEEDS: {
  planName: string;
  planType: 'local' | 'vip';
  tier: number;
  price: number;
  validityDays: number;
  visibilityType: 'radius' | 'city' | 'state' | 'country';
  radiusKm: number | null;
  commissionPercent: number;
  maxUserRedemptionPercent: number;
  description: string;
}[] = [
  { planName: 'Basic',    planType: 'local', tier: 1, price: 500,      validityDays: 30,  visibilityType: 'radius',  radiusKm: 2,    commissionPercent: 10, maxUserRedemptionPercent: 2,   description: 'Local Vendor — district radius 2km' },
  { planName: 'Standard', planType: 'local', tier: 2, price: 1000,     validityDays: 30,  visibilityType: 'radius',  radiusKm: 5,    commissionPercent: 15, maxUserRedemptionPercent: 5,   description: 'Local Vendor — district radius 5km' },
  { planName: 'Premium',  planType: 'local', tier: 3, price: 3000,     validityDays: 30,  visibilityType: 'radius',  radiusKm: 7,    commissionPercent: 18, maxUserRedemptionPercent: 7,   description: 'Local Vendor — district radius 7km' },
  { planName: 'General',  planType: 'local', tier: 4, price: 5000,     validityDays: 30,  visibilityType: 'radius',  radiusKm: 10,   commissionPercent: 20, maxUserRedemptionPercent: 10,  description: 'Local Vendor — district radius 10km' },
  { planName: 'Bronze',   planType: 'vip',   tier: 5, price: 500000,   validityDays: 365, visibilityType: 'radius',  radiusKm: 20,   commissionPercent: 25, maxUserRedemptionPercent: 20,  description: 'VIP Vendor — district radius 20km' },
  { planName: 'Silver',   planType: 'vip',   tier: 6, price: 1000000,  validityDays: 365, visibilityType: 'radius',  radiusKm: 50,   commissionPercent: 45, maxUserRedemptionPercent: 40,  description: 'VIP Vendor — district radius 50km' },
  { planName: 'Gold',     planType: 'vip',   tier: 7, price: 2500000,  validityDays: 365, visibilityType: 'state',   radiusKm: null, commissionPercent: 65, maxUserRedemptionPercent: 60,  description: 'VIP Vendor — state-wide coverage' },
  { planName: 'Diamond',  planType: 'vip',   tier: 8, price: 5000000,  validityDays: 365, visibilityType: 'country', radiusKm: null, commissionPercent: 99, maxUserRedemptionPercent: 99,  description: 'VIP Vendor — PAN India coverage' },
  { planName: 'Platinum', planType: 'vip',   tier: 9, price: 10000000, validityDays: 365, visibilityType: 'country', radiusKm: null, commissionPercent: 0,  maxUserRedemptionPercent: 100, description: 'VIP Vendor — international coverage, full redemption' },
];

export async function seedDefaultVendorPlans(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [tables] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vendor_plans'`,
      [database],
    );
    if (!tables.length) return;

    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM vendor_plans`,
    );
    if (Number(existing?.[0]?.n ?? 0) > 0) return;

    let inserted = 0;
    for (const seed of VENDOR_PLAN_SEEDS) {
      try {
        await connection.query(
          `INSERT INTO vendor_plans
            (id, plan_name, description, plan_type, tier, price, validity_days, visibility_type,
             radius_km, commission_percent, max_user_redemption_percent, payment_mode,
             promo_banner_ads, promo_video_ads, promo_priority_listing, is_active, metadata,
             created_at, updated_at)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'both', 0, 0, 0, 1, NULL, NOW(6), NOW(6))`,
          [
            seed.planName,
            seed.description,
            seed.planType,
            seed.tier,
            seed.price,
            seed.validityDays,
            seed.visibilityType,
            seed.radiusKm,
            seed.commissionPercent,
            seed.maxUserRedemptionPercent,
          ],
        );
        inserted += 1;
      } catch (err) {
        console.warn(
          `[admin-service] vendor-plan seed ${seed.planName} skipped:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (inserted > 0) console.log(`[admin-service] Seeded ${inserted} vendor plan tiers`);
  } catch (err) {
    console.warn(
      '[admin-service] vendor-plan seed skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
