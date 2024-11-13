import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env' });

const runMigrations = async () => {
  // Disable prefetch as it is not supported for "Transaction" pool mode
  const migrationClient = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(migrationClient);

  console.log("Running migrations...");

  await migrate(db, {
    migrationsFolder: "drizzle"
  });

  console.log("Migrations complete!");

  await migrationClient.end();
};

runMigrations().catch((err) => {
  console.error("Migration failed!", err);
  process.exit(1);
}); 