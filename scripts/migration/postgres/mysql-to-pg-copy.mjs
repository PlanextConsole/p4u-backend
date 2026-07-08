#!/usr/bin/env node
/**
 * Copy MySQL tables → Postgres staging (column intersection + safe JSON).
 *
 * Usage:
 *   export MYSQL_PASSWORD='...'
 *   export P4U_PG_PASSWORD='...'
 *   export MIGRATION_SERVICE=catalog-management-services
 *   export MIGRATION_TABLES=product_categories,product_subcategories,...
 *   node scripts/migration/postgres/mysql-to-pg-copy.mjs
 */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const serviceName = process.env.MIGRATION_SERVICE || 'auth-management-services';
const serviceRoot = join(here, '../../..', serviceName);
const require = createRequire(import.meta.url);
const mysql = require(join(serviceRoot, 'node_modules/mysql2/promise'));
const { Pool } = require(join(serviceRoot, 'node_modules/pg'));

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

const TABLES = (process.env.MIGRATION_TABLES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const BOOL_COLS = new Set(
  (process.env.MIGRATION_BOOL_COLS ||
    'is_active,trending,self_delivery,availability,emergency,is_available').split(',').map((s) => s.trim()),
);

function isJsonColumnName(name) {
  return /_json$/i.test(name) || ['metadata', 'payload', 'media_json', 'attributes', 'banner_urls'].includes(name);
}

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
  if (!TABLES.length) {
    console.error('Set MIGRATION_TABLES (comma-separated table names)');
    process.exit(1);
  }

  console.log(`Service: ${serviceName}`);
  console.log(`Tables: ${TABLES.join(', ')}`);

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
        console.warn(`Skip ${table}: no matching postgres columns`);
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
        const values = columns.map((c) => cellValue(c, row[c]));
        await pgPool.query(sql, values);
      }
      console.log(`${table}: ${rows.length} rows copied`);
    }

    if (process.env.MIGRATION_SEQUENCE_TABLE && process.env.MIGRATION_SEQUENCE_COLUMN) {
      const t = process.env.MIGRATION_SEQUENCE_TABLE;
      const c = process.env.MIGRATION_SEQUENCE_COLUMN;
      await pgPool.query(
        `SELECT setval(pg_get_serial_sequence('${t}', '${c}'), COALESCE((SELECT MAX(${c}) FROM ${t}), 1))`,
      );
      console.log(`${t}.${c} sequence reset`);
    }

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
