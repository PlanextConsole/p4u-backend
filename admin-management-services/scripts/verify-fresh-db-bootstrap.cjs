/**
 * Smoke test for the zero-touch bootstrap path:
 *   1. Drops + recreates an empty DB
 *   2. Runs bootstrapAllSharedTables() + repair + seed functions
 *   3. Asserts table count, vendor_plan rows, platform_variable rows
 *
 * Usage: node scripts/verify-fresh-db-bootstrap.cjs
 */
const path = require('path');
process.env.DB_NAME = 'p4u_admin_db_test';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'root@123';

require('ts-node/register/transpile-only');

const mysql = require('mysql2/promise');

(async () => {
  // 1. Drop the test DB so we know we are starting from zero.
  const root = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });
  await root.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
  await root.end();
  console.log(`[verify] Dropped ${process.env.DB_NAME} (fresh start)`);

  // 2. Run the bootstrap path (same code admin server.ts runs at startup).
  const { bootstrapAllSharedTables } = require(path.resolve(__dirname, '..', 'src', 'config', 'bootstrapSchema.ts'));
  const {
    repairCustomerProfilesSchema,
    repairCatalogVendorsSchema,
    repairVendorPlansSchema,
    repairPushNotificationSendsSchema,
    repairMediaLibrarySchema,
    repairBulkUploadJobsSchema,
    repairProductAttributesSchema,
    repairPricingEngineSchema,
    repairOccupationAdminCreatePlatformVariableSeed,
    seedPlatformVariableDefaults,
    seedDefaultVendorPlans,
  } = require(path.resolve(__dirname, '..', 'src', 'config', 'schemaRepair.ts'));

  await bootstrapAllSharedTables();
  await repairCustomerProfilesSchema();
  await repairCatalogVendorsSchema();
  await repairVendorPlansSchema();
  await repairPushNotificationSendsSchema();
  await repairMediaLibrarySchema();
  await repairBulkUploadJobsSchema();
  await repairProductAttributesSchema();
  await repairPricingEngineSchema();
  await repairOccupationAdminCreatePlatformVariableSeed();
  await seedPlatformVariableDefaults();
  await seedDefaultVendorPlans();

  // 3. Verify.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [tables] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [process.env.DB_NAME],
  );
  const [vars] = await conn.query(`SELECT COUNT(*) AS n FROM admin_platform_variables`);
  const [plans] = await conn.query(`SELECT COUNT(*) AS n FROM vendor_plans`);
  const [pricingCol] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'catalog_vendors' AND COLUMN_NAME = 'vendor_plan_id'`,
    [process.env.DB_NAME],
  );

  console.log('---');
  console.log(`[verify] Tables created:        ${tables[0].n}`);
  console.log(`[verify] Platform variables:    ${vars[0].n}`);
  console.log(`[verify] Vendor plan tiers:     ${plans[0].n}`);
  console.log(`[verify] catalog_vendors.vendor_plan_id present: ${pricingCol[0].n === 1 ? 'yes' : 'NO'}`);

  await conn.end();

  const ok =
    tables[0].n >= 60 &&
    vars[0].n >= 11 &&
    plans[0].n === 9 &&
    pricingCol[0].n === 1;
  if (!ok) {
    console.error('[verify] FAILED');
    process.exit(1);
  }
  console.log('[verify] PASSED — fresh DB came up zero-touch.');
})().catch((e) => {
  console.error('[verify] error:', e);
  process.exit(1);
});
