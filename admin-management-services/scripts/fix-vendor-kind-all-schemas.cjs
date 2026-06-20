const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root@123',
  });

  try {
    const [tables] = await conn.query(
      "SELECT TABLE_SCHEMA FROM information_schema.TABLES WHERE TABLE_NAME = 'catalog_vendors'"
    );
    const [cols] = await conn.query(
      "SELECT TABLE_SCHEMA FROM information_schema.COLUMNS WHERE TABLE_NAME = 'catalog_vendors' AND COLUMN_NAME = 'vendor_kind'"
    );
    const have = new Set(cols.map((r) => r.TABLE_SCHEMA));

    for (const row of tables) {
      const schema = row.TABLE_SCHEMA;
      if (have.has(schema)) {
        console.log(`OK: ${schema}.catalog_vendors already has vendor_kind`);
        continue;
      }
      console.log(`PATCH: adding vendor_kind to ${schema}.catalog_vendors`);
      await conn.query(
        `ALTER TABLE \`${schema}\`.\`catalog_vendors\` ADD COLUMN \`vendor_kind\` VARCHAR(16) NOT NULL DEFAULT 'product'`
      );
      console.log(`DONE: ${schema}.catalog_vendors.vendor_kind added`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

