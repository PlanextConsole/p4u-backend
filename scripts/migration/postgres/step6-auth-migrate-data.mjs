#!/usr/bin/env node
/**
 * Phase 6 — copy auth tables MySQL → Postgres staging.
 */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const authRoot = join(here, '../../../auth-management-services');
const require = createRequire(import.meta.url);
const mysql = require(join(authRoot, 'node_modules/mysql2/promise'));
const { Pool } = require(join(authRoot, 'node_modules/pg'));

const MYSQL = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USERNAME || 'p4u',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || 'planext4u',
  database: process.env.DB_NAME || 'p4u_admin_db',
};

const PG = {
  host: process.env.PG_HOST || 'localhost',
  user: process.env.P4U_PG_USER || 'p4u_app',
  password: process.env.P4U_PG_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.P4U_PG_DATABASE || 'p4u_admin_db_staging',
  port: parseInt(process.env.PG_PORT || '5432', 10),
};

const TABLES = [
  'customer_occupations',
  'users',
  'customer_profiles',
  'vendor_signup_requests',
  'catalog_vendors',
];

const BOOL_COLS = new Set(['is_active', 'trending', 'self_delivery']);

function isJsonColumnName(name) {
  return /_json$/i.test(name) || ['metadata', 'payload', 'media_json'].includes(name);
}

/** Normalize any MySQL JSON value to a Postgres-safe JSON string (never raw invalid text). */
function toPgJsonString(val) {
  if (val === null || val === undefined) return null;
  if (Buffer.isBuffer(val)) val = val.toString('utf8');

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      return JSON.stringify({ _legacy_mysql: trimmed });
    }
  }

  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return JSON.stringify({ _legacy_mysql: String(val) });
    }
  }

  return JSON.stringify({ _legacy_mysql: String(val) });
}

function normalizeScalar(col, val) {
  if (val === null || val === undefined) return null;
  if (BOOL_COLS.has(col)) return Boolean(Number(val));
  if (Buffer.isBuffer(val)) return val.toString('utf8');
  if (val instanceof Date) return val;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

function cellValue(col, val) {
  if (val === null || val === undefined) return null;
  if (isJsonColumnName(col)) return toPgJsonString(val);
  return normalizeScalar(col, val);
}

async function main() {
  if (!PG.password) {
    console.error('Set P4U_PG_PASSWORD');
    process.exit(1);
  }

  const mysqlConn = await mysql.createConnection({ ...MYSQL, jsonStrings: true });
  const pgPool = new Pool(PG);

  try {
    for (const table of TABLES) {
      const [cols] = await mysqlConn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [MYSQL.database, table],
      );
      const mysqlColumns = cols.map((r) => r.COLUMN_NAME);

      const pgCols = await pgPool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table],
      );
      const pgColumnSet = new Set(pgCols.rows.map((r) => r.column_name));
      const columns = mysqlColumns.filter((c) => pgColumnSet.has(c));
      const skipped = mysqlColumns.filter((c) => !pgColumnSet.has(c));
      if (skipped.length) {
        console.warn(`${table}: skipping mysql-only columns: ${skipped.join(', ')}`);
      }
      if (!columns.length) {
        console.warn(`Skip ${table}: no columns`);
        continue;
      }

      const [rows] = await mysqlConn.query(`SELECT * FROM \`${table}\``);
      await pgPool.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);

      if (!rows.length) {
        console.log(`${table}: 0 rows`);
        continue;
      }

      const colList = columns.map((c) => `"${c}"`).join(', ');
      const placeholders = columns
        .map((c, i) => (isJsonColumnName(c) ? `$${i + 1}::jsonb` : `$${i + 1}`))
        .join(', ');
      const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;

      for (const row of rows) {
        try {
          const values = columns.map((c) => cellValue(c, row[c]));
          await pgPool.query(sql, values);
        } catch (err) {
          console.error(`${table} row ${row.id ?? '?'} failed`);
          for (const c of columns) {
            if (isJsonColumnName(c)) {
              console.error(`  ${c} raw=${JSON.stringify(row[c])} pg=${toPgJsonString(row[c])}`);
            }
          }
          throw err;
        }
      }
      console.log(`${table}: ${rows.length} rows copied`);
    }

    await pgPool.query(
      `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`,
    );
    console.log('users id sequence reset');
    console.log('Done.');
  } finally {
    await mysqlConn.end();
    await pgPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
