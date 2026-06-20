/**
 * Creates `vendor_plans` if missing (migrations/2026-04-29-create-vendor-plans.sql).
 * Usage: npm run migrate:vendor-plans
 * Requires: .env with DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '2026-04-29-create-vendor-plans.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error(`Invalid DB_NAME "${database}" — use letters, numbers, underscore only.`);
  }

  const serverConn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    await serverConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await serverConn.end();
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });
  try {
    console.log(`Applying vendor_plans table on database "${database}" (${host}:${port}) ...`);
    await conn.query(sql);
    console.log('OK: vendor_plans table is present (created or already existed).');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
