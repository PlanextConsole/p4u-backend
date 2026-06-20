import { createConnection, RowDataPacket } from 'mysql2/promise';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Reads the canonical schema dump shipped at `migrations/2026-05-07-bootstrap-schema.sql`
 * and runs every `CREATE TABLE IF NOT EXISTS` against the target DB. Idempotent: rerunning
 * is a no-op when tables already exist with compatible structure (column-level upgrades are
 * handled by `schemaRepair.ts`).
 *
 * Goal: a brand-new prod DB needs zero manual SQL — admin service comes up and creates all
 * 60+ shared tables (admin_*, catalog_*, classified_*, commerce_*, content_*, customer_*,
 * media_library_*, pos_*, product_*, service_*, social_*, user_*, vendor_*) before TypeORM
 * tries to validate entities.
 */
export async function bootstrapAllSharedTables(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    // Connect WITHOUT a database first so we can CREATE DATABASE IF NOT EXISTS.
    const root = await createConnection({ host, port, user, password, multipleStatements: false });
    try {
      await root.query(
        `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } finally {
      await root.end().catch(() => undefined);
    }

    connection = await createConnection({ host, port, user, password, database, multipleStatements: false });

    const sqlPath = path.resolve(__dirname, '..', '..', 'migrations', '2026-05-07-bootstrap-schema.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    // Split on `;` followed by newline at end of statement. SQL has no embedded `;` outside strings here.
    const statements = sql
      .split(/;\s*\n/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/^--/.test(s));

    // Schema dump can have inter-table FK references in any order. Disable FK checks during
    // create so order doesn't matter; re-enable at the end. Standard mysqldump practice.
    await connection.query('SET FOREIGN_KEY_CHECKS=0');

    let created = 0;
    for (const stmt of statements) {
      try {
        await connection.query(stmt);
        const m = stmt.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/i);
        if (m) created += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Don't fail startup on individual table issues; log and continue. Repair functions
        // will plug column-level gaps for tables that exist but are out of date.
        console.warn(`[admin-service] bootstrap statement failed (continuing): ${msg.slice(0, 200)}`);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS=1');

    const [count] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [database],
    );
    const tableCount = Number(count?.[0]?.n ?? 0);
    console.log(`[admin-service] Schema bootstrap complete: ${tableCount} tables present (processed ${created} CREATE statements).`);
  } catch (err) {
    console.warn(
      '[admin-service] Schema bootstrap skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
