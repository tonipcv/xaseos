#!/usr/bin/env node
/**
 * Seed script - creates a test user
 * Follows the migration policy: explicit SQL executed via Node script (pg driver)
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Test user credentials
const TEST_USER = {
  email: 'test@xase.ai',
  name: 'Test User',
  password: 'test123456',
  role: 'admin',
};

const DATABASE_URL = process.env.DATABASE_URL;

async function seed() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('Example: DATABASE_URL="postgres://user:pass@host:port/db" node scripts/seed.js');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Check if user already exists
    const checkResult = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [TEST_USER.email]
    );

    if (checkResult.rows.length > 0) {
      console.log(`User ${TEST_USER.email} already exists. Skipping seed.`);
      return;
    }

    // Hash password (same as registration: 10 rounds)
    const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Insert test user
    await pool.query(
      `INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [userId, TEST_USER.email, TEST_USER.name, hashedPassword, TEST_USER.role]
    );

    console.log('✅ Test user created successfully!');
    console.log('');
    console.log('Credentials:');
    console.log(`  Email:    ${TEST_USER.email}`);
    console.log(`  Password: ${TEST_USER.password}`);
    console.log(`  Role:     ${TEST_USER.role}`);
    console.log('');
    console.log('You can now log in at http://localhost:3002/login');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
