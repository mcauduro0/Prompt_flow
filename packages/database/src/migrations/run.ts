/**
 * ARC Investment Factory - Migration Runner
 * Runs SQL migrations in order
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/arc_investment_factory';
  
  console.log('Connecting to database...');
  const sql = postgres(connectionString);

  try {
    // Create migrations tracking table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Get executed migrations
    const executed = await sql<{ name: string }[]>`SELECT name FROM _migrations ORDER BY id`;
    const executedNames = new Set(executed.map(m => m.name));

    // Get migration files
    const migrationFiles = readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      if (executedNames.has(file)) {
        console.log(`Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const sqlContent = readFileSync(join(__dirname, file), 'utf-8');
      
      // Execute migration in a transaction using postgres.js API
      await sql.begin(async (tx: postgres.TransactionSql) => {
        // Use unsafe for raw SQL content
        await tx.unsafe(sqlContent);
        // Use tagged template for parameterized query
        await sql`INSERT INTO _migrations (name) VALUES (${file})`;
      });

      console.log(`Completed: ${file}`);
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
