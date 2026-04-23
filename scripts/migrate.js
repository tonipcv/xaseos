const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected.');

    const sql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf-8');
    // Strip comment lines, then split on semicolons
    const stripped = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = stripped
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let ok = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        ok++;
      } catch (err) {
        console.error(`Failed: ${stmt.substring(0, 80)}...`);
        console.error(err.message);
      }
    }

    console.log(`Migration complete: ${ok}/${statements.length} statements executed.`);
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);
