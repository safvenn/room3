import { readFileSync } from 'fs';
import { Client } from 'pg';

const sql = readFileSync('./supabase/migrations/001_init_schema.sql', 'utf8');

const client = new Client({
  host: 'db.lakkzfbqzukrmykkvpyl.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Safwankallu@00',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Connecting to Supabase...');
  await client.connect();
  console.log('Connected! Running migration...');
  
  try {
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    // Some statements might already exist — log but don't crash
    console.error('Error during migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
