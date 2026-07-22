/**
 * Ensures commerce_cart_items.variation_id exists.
 * TypeORM CartItem maps this column; Postgres step10 schema omitted it.
 */
import { AppDataSource } from './database';

export async function repairCartVariationSchema(): Promise<void> {
  try {
    const asBool = (value: unknown) =>
      value === true || value === 't' || value === 'true' || value === 1;

    const tableExists: Array<{ exists: unknown }> = await AppDataSource.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'commerce_cart_items'
      ) AS exists`,
    );
    if (!asBool(tableExists[0]?.exists)) return;

    const columnExists: Array<{ exists: unknown }> = await AppDataSource.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'commerce_cart_items'
          AND column_name = 'variation_id'
      ) AS exists`,
    );
    if (asBool(columnExists[0]?.exists)) return;

    await AppDataSource.query(
      `ALTER TABLE commerce_cart_items ADD COLUMN variation_id varchar(36) NULL`,
    );
    console.log('[commerce-service] Added commerce_cart_items.variation_id');
  } catch (err) {
    console.warn(
      '[commerce-service] cart variation_id schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  }
}
