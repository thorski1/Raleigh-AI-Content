import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Load environment variables
config();

// Make sure we're using the pooled connection URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Environment variables:", {
    DATABASE_URL: process.env.DATABASE_URL ? "Set" : "Not set",
    NODE_ENV: process.env.NODE_ENV,
  });
  throw new Error("DATABASE_URL is not set");
}

console.log("Connecting to database..."); // Debug log

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, {
  prepare: false,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(client, { schema });
