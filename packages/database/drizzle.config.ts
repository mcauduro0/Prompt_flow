import type { Config } from 'drizzle-kit';

export default {
  schema: './src/models/schema.ts',
  out: './src/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/arc_investment_factory',
  },
} satisfies Config;
