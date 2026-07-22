import { AppDataSource } from './database';

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseInt(value, 10) || 0;
  return 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows: Array<{ cnt: unknown }> = await AppDataSource.query(
    `SELECT COUNT(*)::int AS cnt
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1
       AND column_name = $2`,
    [table, column],
  );
  return asNumber(rows[0]?.cnt) > 0;
}

async function runIgnorable(sql: string): Promise<void> {
  try {
    await AppDataSource.query(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists|duplicate/i.test(message)) return;
    throw error;
  }
}

export async function ensurePropertySchema() {
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS homes_property_listings (
      id varchar(36) NOT NULL PRIMARY KEY,
      customer_id varchar(36) NULL,
      title varchar(180) NOT NULL,
      locality varchar(140) NULL,
      city varchar(120) NULL,
      listing_type varchar(32) NOT NULL DEFAULT 'rent',
      property_type varchar(80) NOT NULL DEFAULT 'Apartment',
      price decimal(14,2) NOT NULL DEFAULT 0,
      posted_by varchar(120) NULL,
      photo_count int NOT NULL DEFAULT 0,
      moderation_status varchar(32) NOT NULL DEFAULT 'pending',
      is_reported boolean NOT NULL DEFAULT false,
      is_auto_flagged boolean NOT NULL DEFAULT false,
      submitted_at timestamp NULL,
      details json NULL,
      metadata json NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!(await columnExists('homes_property_listings', 'customer_id'))) {
    await runIgnorable(
      `ALTER TABLE homes_property_listings ADD COLUMN IF NOT EXISTS customer_id varchar(36) NULL`,
    );
  }

  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_homes_properties_customer ON homes_property_listings (customer_id)`,
  );
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_homes_properties_status ON homes_property_listings (moderation_status)`,
  );

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS property_inquiries (
      id varchar(36) NOT NULL PRIMARY KEY,
      property_id varchar(36) NOT NULL,
      sender_id varchar(36) NOT NULL,
      owner_id varchar(36) NULL,
      message text NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'open',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_property_inquiry_property ON property_inquiries (property_id)`,
  );
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_property_inquiry_owner ON property_inquiries (owner_id)`,
  );
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_property_inquiry_sender ON property_inquiries (sender_id)`,
  );

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS property_saved_searches (
      id varchar(36) NOT NULL PRIMARY KEY,
      customer_id varchar(36) NOT NULL,
      name varchar(120) NOT NULL,
      query_json json NOT NULL,
      notify boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_property_search_customer ON property_saved_searches (customer_id)`,
  );

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS property_rent_trackers (
      id varchar(36) NOT NULL PRIMARY KEY,
      customer_id varchar(36) NOT NULL,
      property_name varchar(180) NOT NULL,
      monthly_rent decimal(14,2) NOT NULL DEFAULT 0,
      paid_months json NULL,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_property_rent_customer ON property_rent_trackers (customer_id)`,
  );
}
