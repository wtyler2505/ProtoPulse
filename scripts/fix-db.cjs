const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE design_comments 
      DROP COLUMN IF EXISTS resolved,
      DROP COLUMN IF EXISTS resolved_by,
      DROP COLUMN IF EXISTS resolved_at,
      DROP COLUMN IF EXISTS status_updated_by;
    `);
    console.log("Columns dropped successfully");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
