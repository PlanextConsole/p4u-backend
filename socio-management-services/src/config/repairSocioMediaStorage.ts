import { AppDataSource } from '../config/database';
import { migrateBlobRowsToDisk } from '../service/socialMediaStorage.service';

async function columnExists(table: string, column: string): Promise<boolean> {
  const db = process.env.DB_NAME || 'p4u_admin_db';
  const rows = await AppDataSource.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** Add storage_path column and make data nullable for disk-backed media. */
export async function repairSocioMediaStorageSchema(): Promise<void> {
  if (!(await columnExists('social_media', 'storage_path'))) {
    await AppDataSource.query(
      `ALTER TABLE social_media ADD COLUMN storage_path varchar(512) NULL AFTER size_bytes`,
    );
    console.log('Socio media: added storage_path column');
  }

  await AppDataSource.query(`ALTER TABLE social_media MODIFY data longblob NULL`);
}

export async function repairAndMigrateSocioMedia(): Promise<void> {
  await repairSocioMediaStorageSchema();
  await migrateBlobRowsToDisk();
}
