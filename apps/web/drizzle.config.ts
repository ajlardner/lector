import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/services/db/schema.ts',
  out: './src/services/db/migrations',
  dialect: 'sqlite',
});
