/**
 * Applies migrations/2026-04-29-catalog-service-base-price.sql
 * Usage: npm run migrate:service-base-price
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '2026-04-29-catalog-service-base-price.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root@123',
    database: process.env.DB_NAME || 'p4u_admin_db',
    multipleStatements: true,
  });
  try {
    const db = process.env.DB_NAME || 'p4u_admin_db';
    console.log(`Applying base_price migration on database "${db}" ...`);
    await conn.query(sql);
    console.log('OK: catalog_service_items.base_price migration applied (or already present).');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
