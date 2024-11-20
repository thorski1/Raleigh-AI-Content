/**
 * Database test helper module
 * Provides utilities for setting up and managing test database environments
 * @module database
 */

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * Debug logger factory to create consistent logging contexts
 * Provides standardized logging patterns across different database operations
 * @param {string} context - The logging context (e.g., "Database", "Setup")
 * @returns {{ log: Function, error: Function }} Logger instance with log and error methods
 * @example
 * const logger = createLogger('MyContext');
 * logger.log('Operation successful'); // [MyContext] Operation successful
 * logger.error('Failed'); // [MyContext Error] Failed
 */
const createLogger = (context: string) => ({
  log: (...args: unknown[]) => console.log(`[${context}]`, ...args),
  error: (...args: unknown[]) => console.error(`[${context} Error]`, ...args),
});

/** Global database logger instance for general database operations */
const dbLogger = createLogger("Database");

/**
 * Database connection configuration object
 * Defines the connection pool settings and timeout configurations
 * @constant
 * @property {number} max - Maximum number of connections (1 for tests to prevent conflicts)
 * @property {number} idle_timeout - Connection idle timeout (0 for infinite)
 * @property {number} max_lifetime - Maximum connection lifetime (0 for infinite)
 * @property {Object} connection - Connection-specific settings
 */
const DB_CONFIG = {
  max: 1,
  idle_timeout: 0,
  max_lifetime: 0,
  connection: {
    application_name: "test-pool",
    statement_timeout: 30000, // 30 seconds timeout for statements
  },
} as const;

/**
 * Global connection pool singleton
 * Maintains a single connection pool throughout the test lifecycle
 * @type {postgres.Sql | null}
 */
let globalPool: postgres.Sql | null = null;

/**
 * Gets or creates a global database connection pool
 * Implements lazy initialization pattern for database connections
 * @returns {Promise<postgres.Sql>} The postgres connection pool
 * @throws {Error} If connection cannot be established or DATABASE_URL is invalid
 * @example
 * const pool = await getGlobalPool();
 * await pool`SELECT NOW()`;
 */
async function getGlobalPool(): Promise<postgres.Sql> {
  if (globalPool) return globalPool;

  const url = new URL(process.env.DATABASE_URL!);
  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";

  globalPool = postgres(process.env.DATABASE_URL!, {
    ...DB_CONFIG,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  try {
    await globalPool`SELECT 1`;
    dbLogger.log("Global connection pool established");
    return globalPool;
  } catch (error) {
    dbLogger.error("Failed to establish connection:", error);
    throw error;
  }
}

/**
 * Executes a database operation with mutex locking to prevent concurrent conflicts
 * Implements retry logic for deadlock scenarios and provides transaction isolation
 * @template T The return type of the operation
 * @param {() => Promise<T>} operation The database operation to execute
 * @returns {Promise<T>} The result of the operation
 * @throws {Error} If operation fails after retries or encounters non-recoverable error
 * @example
 * await withDatabaseLock(async () => {
 *   await db.insert(users).values({ id: 1 });
 * });
 */
async function withDatabaseLock<T>(operation: () => Promise<T>): Promise<T> {
  const lockLogger = createLogger("Database Lock");

  try {
    lockLogger.log("Starting database operation...");
    const result = await operation();
    lockLogger.log("Database operation completed successfully");
    return result;
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError?.code === "40P01") {
      lockLogger.log("Deadlock detected, retrying operation...");
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
      return withDatabaseLock(operation);
    }
    throw error;
  }
}

/**
 * SQL statements for database setup
 * Contains all DDL (Data Definition Language) statements for test database initialization
 * @constant
 * @property {string[]} createSchemas - Statements for creating and configuring schemas
 * @property {string[]} createTables - Statements for creating database tables
 */
const SETUP_STATEMENTS = {
  createSchemas: [
    "DROP SCHEMA IF EXISTS auth CASCADE",
    "DROP SCHEMA IF EXISTS test CASCADE",
    "CREATE SCHEMA auth",
    "CREATE SCHEMA test",
    "SET search_path TO auth, test, public",
    "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public",
  ],
  createTables: [
    `CREATE TABLE auth.users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      profile_image_url TEXT
    )`,
    `CREATE TABLE auth.content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      status TEXT DEFAULT 'draft',
      CONSTRAINT content_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) 
        ON DELETE CASCADE
    )`,
    `CREATE TABLE test.documents (
      id BIGSERIAL PRIMARY KEY,
      content TEXT,
      metadata JSONB DEFAULT '{}',
      embedding vector(1536)
    )`,
  ],
} as const;

/**
 * Creates an isolated test database environment
 * Sets up a fresh database instance with all necessary schemas and tables
 * @param {string} [testId] Unique identifier for the test run
 * @returns {Promise<TestDatabase>} Object containing database instance and cleanup function
 * @throws {Error} If database setup fails or schema creation errors occur
 * @example
 * const { db, cleanup } = await createTestDatabase('auth-test-123');
 * try {
 *   await db.insert(users).values({ ... });
 *   await runTests();
 * } finally {
 *   await cleanup(); // Always clean up after tests
 * }
 */
export async function createTestDatabase(
  testId = Date.now().toString(),
): Promise<TestDatabase> {
  return withDatabaseLock(async () => {
    const setupLogger = createLogger("Database Setup");
    setupLogger.log(`Starting test database setup for test ${testId}...`);

    try {
      const sql = await getGlobalPool();
      const db = drizzle(sql, { schema });

      await sql.begin(async (tx) => {
        setupLogger.log("Setting up database schemas...");
        for (const statement of SETUP_STATEMENTS.createSchemas) {
          await tx.unsafe(statement);
        }

        setupLogger.log("Creating tables...");
        for (const statement of SETUP_STATEMENTS.createTables) {
          await tx.unsafe(statement);
        }
      });

      setupLogger.log("Database setup completed successfully");

      const cleanup = async () => {
        try {
          setupLogger.log(`Running cleanup for test ${testId}...`);
          await sql`SET session_replication_role = replica`;
          await sql`TRUNCATE auth.content, auth.users, test.documents CASCADE`;
          await sql`SET session_replication_role = default`;
          setupLogger.log(`Cleanup complete for test ${testId}`);
        } catch (error) {
          setupLogger.error(`Cleanup error for test ${testId}:`, error);
        }
      };

      return { db, cleanup };
    } catch (error) {
      setupLogger.error(`Database setup failed for test ${testId}:`, error);
      throw error;
    }
  });
}

/**
 * Cleans up global database resources
 * Ensures proper shutdown of database connections and resource cleanup
 * Should be called after all tests are complete, typically in afterAll hook
 * @returns {Promise<void>}
 * @example
 * afterAll(async () => {
 *   await cleanupTestDatabase();
 * });
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (!globalPool) return;

  dbLogger.log("Closing global connection pool...");
  try {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await globalPool.end({ timeout: 15000 });
    globalPool = null;
    dbLogger.log("Global connection pool closed");
  } catch (error) {
    dbLogger.error("Error closing global connection pool:", error);
    globalPool = null;
  }
}

/**
 * TestDatabase type definition
 * Represents the test database environment interface
 * @typedef {Object} TestDatabase
 * @property {PostgresJsDatabase<typeof schema>} db - Drizzle database instance with schema typing
 * @property {() => Promise<void>} cleanup - Function to clean up test data and resources
 */
export type TestDatabase = {
  db: PostgresJsDatabase<typeof schema>;
  cleanup: () => Promise<void>;
};
