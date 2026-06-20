/**
 * Confirms catalog_vendors.vendor_kind exists on the DB from .env (same as migrate script).
 * Usage: npm run verify:vendor-kind
 */
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root@123',
    database: process.env.DB_NAME || 'p4u_admin_db',
  });

  const db = process.env.DB_NAME || 'p4u_admin_db';
  try {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'catalog_vendors' AND COLUMN_NAME = 'vendor_kind'`,
      [db],
    );
    if (!rows.length) {
      console.error(`MISSING: vendor_kind on ${db}.catalog_vendors — run: npm run migrate:vendor-kind`);
      process.exit(1);
    }
    console.log(`OK: vendor_kind exists on ${db}.catalog_vendors`, rows[0]);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
