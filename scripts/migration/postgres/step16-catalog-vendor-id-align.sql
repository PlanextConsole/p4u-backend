-- Fix Postgres uuid vs varchar mismatch on catalog vendor/product joins.
-- TypeORM @PrimaryGeneratedColumn('uuid') can leave catalog_vendors.id as uuid while
-- catalog_products.vendor_id stayed varchar(36) from MySQL migration.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'catalog_vendors'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE catalog_vendors
      ALTER COLUMN id TYPE varchar(36) USING id::text;
  END IF;
END $$;
